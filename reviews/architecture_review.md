# MyCodex 架构与测试覆盖评审报告

> 评审日期：2026-03-17
> 评审人：CHS Agent Teams 多引擎评审专家
> 评审范围：测试覆盖、架构一致性、模块边界、技术债务

---

## 执行摘要

MyCodex 项目整体架构设计清晰，HydroSIS 文档规划合理，前后端分离路径已落地。
主要风险集中在：三处代码重复（electron/main.js、electron/shared.js、server/lib/shared.ts 形成的三角关系）、
烟雾测试覆盖严重不足、Fastify 服务端路由未接入鉴权中间件。

---

## 一、测试覆盖评审

### 当前状态

- 测试文件：1 个（scripts/smoke.js）
- 测试用例：12 个
- 测试框架：Node.js 内建 assert（无测试框架依赖）
- CI/CD 集成：未见配置文件（无 .github/workflows、无 package.json test 脚本）

### 覆盖分析

| 已覆盖模块 | 用例数 | 覆盖质量 |
|-----------|--------|---------|
| slugify | T1、T2 | 基础路径覆盖 |
| scanArtifacts | T3、T12 | 深度边界 + node_modules 忽略 |
| git precheck | T4 | 仅外部 git 命令，非单元测试 |
| readManifest（容错） | T5 | 仅 JSON 损坏场景 |
| sanitizeManifest | T6 | enum 校验覆盖 |
| appendCapped | T7 | 边界截断覆盖 |
| detectConflictMarkers | T8 | 正反两例 |
| readArtifactContent | T9、T10 | 扩展名拒绝 + 截断 |
| quoteArg | T11 | 空格、百分号、安全字符串 |

### 严重缺失的测试

服务端路由层（0 覆盖）：/api/projects CRUD、/api/team/run、/api/backup/github、/api/auth/* 回调逻辑全部无测试。

安全功能（0 覆盖）：isPathWithinRoots 路径穿越防护无测试、authGuard / roleGuard JWT 鉴权无测试、artifacts:read 的路径限制逻辑无测试。

传输抽象层（0 覆盖）：IpcTransport / HttpTransport 均无测试，createTransport() 环境检测逻辑无测试。

Git 操作服务（0 覆盖）：initGitTeamFlow、bindGiteaRemote、runGitBackup 等复杂状态机逻辑无测试。

数据库层（0 覆盖）：SQLite schema 迁移逻辑无测试，findUserByIdentity、createUser 等 CRUD 无测试。

---

## 二、严重问题（必须修复）

### RED-1：electron/main.js 与 electron/shared.js 与 server/lib/shared.ts 三份平行代码

**问题描述**

同一批业务逻辑存在三处独立拷贝：
- electron/shared.js（CJS，导出给 smoke.js 使用）
- electron/main.js（CJS，内嵌了 slugify/createDefaultManifest/sanitizeManifest/scanArtifacts 等全套）
- server/lib/shared.ts（ESM TypeScript，服务端复用版本）

electron/main.js 中的 sanitizeManifest 接受 (manifest, defaults) 两个参数；
electron/shared.js 中的 sanitizeManifest 接受 (dirty, projectName) 一个参数；
server/lib/shared.ts 同 electron/main.js 的两参数签名。

签名不一致已造成行为差异，未来分叉风险极高。

**修复建议**

按 hydrosis-architecture.md 的 D-2 决策，将 electron/main.js 中所有业务函数迁移到 server/services/，
electron/main.js 应仅保留约 50 行 IPC 胶水代码。
electron/shared.js 应成为 server/lib/shared.ts 的 CommonJS 适配层或直接删除，
让 smoke.js 改为调用编译后的 server/lib/shared.js。

**受影响文件**

- Y:/MyCodex/electron/main.js（约 1284 行，含大量重复业务逻辑）
- Y:/MyCodex/electron/shared.js（独立维护，有 sanitizeManifest 签名分叉）
- Y:/MyCodex/server/lib/shared.ts

---

### RED-2：Fastify 路由端点未接入 authGuard，API 完全公开

**问题描述**

server/auth/guard.ts 已实现 authGuard 和 roleGuard，但 server/routes/auth.ts 仅在 /api/auth/me 挂载了 authGuard。
其余所有路由（projects、team、git、artifacts、runtime）均无鉴权前置：

- GET  /api/projects       — 无鉴权
- POST /api/projects       — 无鉴权
- POST /api/team/run       — 无鉴权（可执行任意 PowerShell 命令）
- POST /api/backup/github  — 无鉴权（可触发任意 git push）

POST /api/team/run 特别危险：攻击者可构造 payload 指定任意 workspace 路径运行 team.cmd，
在服务器上以应用进程权限执行代码。

**修复建议**

在 server/index.ts 或各路由文件中为写操作和敏感操作添加 preHandler: [authGuard]。
至少对 team、git、backup 路由强制要求 JWT。

---

### RED-3：server/lib/shared.ts 第 379-383 行 quoteArg 实现存在 Bug

**问题描述**

在 server/lib/shared.ts 中，quoteArg 函数存在以下问题：

```
const needsQuote = /[s"^%!&|<>()]/u.test(str);
```
反斜杠 s 被写成字面量 s，空格检测失效，含空格参数不会被引号包裹。

```
const escaped = str.replace(/^/g, "^^")
```
正则 /^/ 匹配行首而非 ^ 字符，转义逻辑完全错误。

而 electron/shared.js 中的实现使用了正确的 /\^/g 和模板字符串，两者行为不同，服务端存在命令注入风险。

**修复建议**

将 electron/shared.js 中正确的 quoteArg 实现同步到 server/lib/shared.ts，使用 /[\s"^%!&|<>()]/u 作为检测正则。

---

### RED-4：server/index.ts 使用硬编码 JWT secret，且 CORS 全部开放

**问题描述**

```
const JWT_SECRET = process.env.MYCODEX_JWT_SECRET || 'mycodex-dev-secret-change-in-prod';
await app.register(cors, { origin: true });
```

默认 secret 是明文字符串，若 .env 配置遗漏，生产环境会使用弱 secret。
CORS origin: true 在生产部署中意味着任意源均可跨域调用 API。

**修复建议**

1. 若 MYCODEX_JWT_SECRET 未设置，应在 NODE_ENV=production 时直接抛出异常拒绝启动。
2. CORS 应从环境变量读取允许的域名白名单。

---

## 三、建议改进（酌情采纳）

### YELLOW-1：smoke.js 缺少对 isPathWithinRoots 的测试

isPathWithinRoots 是关键安全函数，防止路径穿越攻击，但 smoke.js 没有覆盖它。
建议新增：T13（正常路径返回 true）、T14（路径穿越返回 false）、T15（符号链接场景）。

### YELLOW-2：electron/main.js 超过 1280 行，违反架构文档目标

hydrosis-architecture.md 节 2.3 明确要求将 electron/main.js 精简为约 50 行 IPC 胶水代码。
当前 main.js 仍包含完整业务实现，Phase 1 重构尚未完成。
建议在 roadmap.md 中标记此项为"进行中"，避免误认为重构已完成。

### YELLOW-3：server/routes/team.ts 过度简化，缺少输入验证

request.body 直接透传给 runTeamCommand，没有 JSON Schema 校验。
Fastify 的最大优势之一是原生 JSON Schema 验证，此处完全未使用。
建议为 payload.task、payload.workspace、payload.cwd 等字段添加长度限制和格式约束。

### YELLOW-4：roadmap.md 与 hydrosis-architecture.md 的 Roadmap 章节不同步

两份文档描述的是不同维度的 4 阶段计划，互无引用，容易造成优先级混乱。
建议在 roadmap.md 中添加说明："HydroSIS 扩展计划详见 hydrosis-architecture.md 第 7 节"。

### YELLOW-5：server/services/git-ops.ts 代码可读性差

git-ops.ts 在转换为 TypeScript 时采用极度压缩的单行写法，与 electron/main.js 中良好的可读性形成鲜明对比。
建议恢复正常缩进风格，方便 Code Review 和调试。

### YELLOW-6：ALLOWED_AUTH_URLS 常量定义但从未使用

electron/main.js 定义了 ALLOWED_AUTH_URLS 常量但从未引用，是死代码。
建议删除或实际使用该列表做白名单校验。

### YELLOW-7：缺少测试框架和 CI 配置

- package.json 中无测试框架（jest/vitest/mocha）
- 无 .github/workflows/ 或其他 CI 配置
- smoke 脚本没有被 test 脚本别名引用

建议：将 "test": "node scripts/smoke.js" 加入 package.json，添加 GitHub Actions workflow，考虑引入 vitest。

### YELLOW-8：OAuth 回调中 token 通过 URL query string 传递

JWT token 出现在 URL 中会被记录到浏览器历史、服务端日志、CDN 日志。
建议改为通过 HttpOnly cookie 或 POST 响应体传递 token。

---

## 四、做得好的地方

### GREEN-1：Transport 抽象层设计优秀

src/transport/ 的 MyCodexTransport 接口设计精良：
- 同一接口屏蔽 Electron IPC 和 HTTP 两种传输方式
- createTransport() 自动检测运行环境，零配置切换
- 接口方法与 IPC Channel 名称严格对应（见 hydrosis-architecture.md 表 2.2）

这是 HydroSIS 架构中最有价值的设计决策，已正确落地。

### GREEN-2：writeManifest 使用原子写入防止数据损坏

写临时文件再重命名的模式保证了写入中断时不会产生损坏的 manifest 文件。
三处实现（main.js、shared.js、server/lib/shared.ts）均正确使用了此模式。

### GREEN-3：安全防护意识强，多处关键防护已实现

- readArtifactContent 扩展名白名单（拒绝 .exe 等危险类型）
- file:open 的路径根目录限制（isPathWithinRoots）
- sanitizeManifest 对枚举字段的强制合法性校验
- runGwsCommand 和 runLzcCommand 的二进制名称前缀验证（防止任意命令执行）
- detectConflictMarkers 只读取文件头 64KB，防止大文件 DoS

### GREEN-4：架构文档与决策记录（ADR）齐全

hydrosis-architecture.md 包含架构决策记录（D-1 到 D-4）、IPC 到 HTTP 路由映射表、
风险矩阵和缓解措施、完整的目录结构规划。
这是中小项目中较为罕见的高质量架构文档，便于新成员快速上手。

### GREEN-5：命令超时机制完整

electron/main.js 和 server/lib/shared.ts 的 runShell/runCmd 均实现了 5 分钟超时机制，
超时后调用 child.kill('SIGTERM') 并在警告中记录超时信息。
这防止了长时间运行的 Agent 任务阻塞整个进程。

### GREEN-6：smoke.js 统一从 shared.js 引入，消除测试分叉

smoke.js 已统一从 electron/shared.js 引入，测试与实现保持同步。

### GREEN-7：SQLite Schema 设计合理

- 使用 TEXT PRIMARY KEY 存 UUID，避免 INTEGER rowid 在分布式场景的问题
- user_identities 表的 UNIQUE(provider, external_id) 约束正确
- 为高频查询字段（status、created_at、project_id）建立了索引

---

## 五、技术债务清单（按优先级）

| 优先级 | 问题 | 影响 | 预估工作量 |
|--------|------|------|-----------|
| P0 | RED-3：server/lib/shared.ts quoteArg Bug | 命令注入安全漏洞 | 1 小时 |
| P0 | RED-2：API 路由无鉴权 | 未授权访问全部 API | 半天 |
| P1 | RED-1：三份平行代码 | 维护成本，行为分叉 | 2-3 天 |
| P1 | RED-4：弱 JWT secret 默认值 + CORS 全开 | 生产安全风险 | 2 小时 |
| P2 | YELLOW-7：无 CI，无 npm test | 回归测试缺失 | 半天 |
| P2 | YELLOW-1：isPathWithinRoots 无测试 | 安全函数未验证 | 2 小时 |
| P3 | YELLOW-3：路由层无 JSON Schema 校验 | 输入注入风险 | 1 天 |
| P3 | YELLOW-8：token 在 URL 中传递 | token 泄露风险 | 2 小时 |
| P4 | YELLOW-2：main.js 重构未完成 | 架构偏离规划 | 3-5 天 |
| P4 | YELLOW-5：git-ops.ts 可读性差 | 维护成本 | 半天 |

---

## 六、架构文档与实际代码一致性核查

| 架构文档承诺 | 实际状态 | 结论 |
|------------|---------|------|
| server/services/ 服务层 | 已存在 project.ts、team-runner.ts、git-ops.ts、artifact.ts 等 | 一致 |
| src/transport/ 抽象层 | 已实现 types.ts、ipc-transport.ts、http-transport.ts、index.ts | 一致 |
| server/auth/ 鉴权模块 | 已实现 jwt.ts、google.ts、wechat.ts、gitea.ts、guard.ts | 一致 |
| server/db/ 数据库层 | schema.sql 和 index.ts 已存在 | 一致 |
| electron/main.js 精简为约 50 行 | 实际 1284 行，仍含完整业务逻辑 | 不一致 |
| deploy/ 容器化配置 | docker-compose.yml、Dockerfile 均已存在 | 一致 |
| server/ws/task-stream.ts | 已存在 | 一致 |
| architecture.md 提到的 9 个模块 | 对应 IPC handler 全部在 main.js 中实现 | 一致 |

---

## 七、总结

项目架构规划质量高，Phase 1（前后端分离）的主要结构已落地。
当前最紧迫的问题是两个安全 Bug（RED-3 quoteArg 和 RED-2 无鉴权路由），
以及长期维护风险（RED-1 三份平行代码）。

测试覆盖方面，smoke 测试 12 个用例质量不错，但覆盖面严重偏窄，
服务端、安全层、传输层均无测试，建议在 Phase 1 完成前先补充这三层的基础测试。
