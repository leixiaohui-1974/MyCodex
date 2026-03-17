# MyCodex 项目综合评审报告

**评审日期**: 2026-03-17
**评审团队**: CHS Agent Teams × 5 路并发评审
**评审引擎**: claude-sonnet-4-6 + 多视角交叉验证

---

## 总体评价

MyCodex 是一个架构设计良好的桌面协作工作区系统（Electron + React + Fastify + SQLite），安全基础意识强（contextIsolation、参数化 SQL、原子文件写入），但存在**安全防线未完全闭合**的问题——多处已实现的安全工具（如 `isPathWithinRoots`、`authGuard`）未被全面应用。

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | 7/10 | Transport 抽象优秀，但 main.js 过大未拆分 |
| 安全性 | 4/10 | 基础好但防线有大量缺口 |
| 代码质量 | 6/10 | TS 严格模式，但 App.tsx 1256 行需拆分 |
| 测试覆盖 | 3/10 | 仅 12 个烟雾测试，无 CI |
| 部署配置 | 6/10 | Docker 完整但缺 .dockerignore 和安全加固 |
| 文档质量 | 8/10 | hydrosis-architecture.md 含 ADR 记录，质量高 |

---

## 🔴 严重问题汇总（共 14 项，必须修复）

### P0 — 安全漏洞（立即修复）

| # | 问题 | 位置 | 风险 | 修复难度 |
|---|------|------|------|----------|
| 1 | **路径遍历漏洞** — projects/artifacts/git 路由均未调用已有的 `isPathWithinRoots` | electron/main.js, server/routes/projects.ts | 任意目录读写 | 低 |
| 2 | **未鉴权端点** — /api/projects, /api/team/run, /api/git/* 无 authGuard | server/routes/*.ts | 匿名命令执行 | 低 |
| 3 | **Shell 注入** — deployGitea 用 shell:true 拼接命令 | electron/main.js L593 | 任意命令执行 | 低 |
| 4 | **Skill invoke 代码注入** — 任意用户可注册指向系统文件的 entry_point | server/services/skill-registry.ts | 任意代码执行 | 低 |
| 5 | **JWT 双实例冲突** — @fastify/jwt 是死代码，两套实现读不同环境变量 | server/index.ts + auth/jwt.ts | 认证系统崩溃 | 低 |
| 6 | **硬编码 JWT Secret** — 遗漏环境变量时使用公开默认值 | server/index.ts | 令牌伪造 | 低 |
| 7 | **微信 OAuth CSRF** — state 参数生成后未存储，回调时未校验 | server/auth/wechat.ts | 账号劫持 | 中 |
| 8 | **OAuth Token 暴露在 URL** — ?token=xxx 被日志/Referer 全量记录 | server/routes/auth.ts | 令牌泄露 | 中 |
| 9 | **shared.ts 的 quoteArg Bug** — \s 写成字面量 s，正则逻辑错误 | server/lib/shared.ts L379 | 命令注入 | 低 |

### P1 — 架构/质量问题（本迭代修复）

| # | 问题 | 位置 | 影响 | 修复难度 |
|---|------|------|------|----------|
| 10 | **App.tsx 1256 行单组件** — 22+ useState，任何状态变更触发全树重渲染 | src/App.tsx | 性能+可维护性 | 高 |
| 11 | **Transport 抽象未被使用** — 全文直接调 window.mycodex，HttpTransport 形同虚设 | src/App.tsx | Web 模式不可用 | 中 |
| 12 | **三份平行代码已分叉** — main.js/shared.js/shared.ts 签名不一致 | electron/ + server/ | Bug 分叉 | 中 |
| 13 | **缺少 .dockerignore** — .env 可能被 COPY 进镜像层 | deploy/ | 密钥泄露 | 低 |
| 14 | **完全无 CI/CD** — smoke.js 从未被自动执行 | 项目根目录 | 无质量门禁 | 中 |

---

## 🟡 建议改进（共 20+ 项，酌情采纳）

### 后端
- CORS origin:true 过于宽松，生产环境应白名单
- API 缺少版本前缀 /api/v1/
- DB Schema 核心字段缺 NOT NULL
- WebSocket 端点缺认证
- author_id 由客户端提交可伪造
- findOrCreate 竞态条件（需 db.transaction 包裹）
- 内存任务队列重启后丢失

### Electron
- sandbox 未显式声明
- 生产包未禁用 DevTools
- payload 字段无长度限制
- runtimeStatusCache 无 TTL
- sanitizeName 正则不支持日韩字符

### 前端
- 三处重复类型定义需统一
- 初始化 useEffect 无 try/catch
- applyPreset 用 window.confirm 阻塞线程

### DevOps
- Docker 容器以 root 运行
- 内部服务端口绑定 0.0.0.0
- gitea:latest 使用浮动 tag
- depends_on 无健康检查
- npm scripts 依赖 PowerShell（Linux 不兼容）

---

## 🟢 做得好的地方

1. **Transport 抽象层设计精良** — IPC/HTTP 双实现 + 工厂模式
2. **参数化 SQL 查询** — 全量使用 prepare().run()，零 SQL 注入
3. **Gitea Webhook 签名验证** — timingSafeEqual 防时序攻击
4. **contextIsolation + nodeIntegration:false** — Electron 安全模型正确
5. **原子文件写入** — writeManifest 使用 tmpfile + rename
6. **SQLite WAL + 外键约束** — 数据库配置规范
7. **输出缓冲 512KB 上限** — 防内存耗尽
8. **hydrosis-architecture.md** — 含 ADR 决策记录，文档质量高
9. **artifacts:read 路径校验** — 已有完整安全模式，只需推广

---

## 修复优先级路线图

### 第 1 阶段：安全加固（预计 1-2 天）
- [ ] 统一调用 isPathWithinRoots（P0-1）
- [ ] 为所有路由挂载 authGuard（P0-2）
- [ ] deployGitea 改用 runCmd shell:false（P0-3）
- [ ] skill-registry 加 admin 角色 + 路径白名单（P0-4）
- [ ] 清理 JWT 双实例，强制 secret 必填（P0-5,6）
- [ ] 修复 shared.ts quoteArg Bug（P0-9）
- [ ] 创建 .dockerignore（P1-13）

### 第 2 阶段：架构优化（预计 3-5 天）
- [ ] App.tsx 按职责拆分为 4-6 个子组件（P1-10）
- [ ] 全面使用 Transport 抽象替换 window.mycodex 直调（P1-11）
- [ ] 统一 shared.js / shared.ts 代码，消除分叉（P1-12）
- [ ] main.js 拆分为 handlers/ + utils/ 模块（约 50 行入口）

### 第 3 阶段：质量保障（预计 2-3 天）
- [ ] 添加 GitHub Actions CI 流水线（P1-14）
- [ ] 补充关键路径单元测试（isPathWithinRoots、authGuard、quoteArg）
- [ ] OAuth 流程安全加固（state 校验、token 改 Cookie 传递）
- [ ] Docker 安全加固（非 root 用户、固定镜像版本、内部端口）

---

## 详细评审报告索引

| 报告 | 文件 |
|------|------|
| 前端代码质量 | [reviews/frontend_review.md](frontend_review.md) |
| 后端代码质量 | [reviews/backend_review.md](backend_review.md) |
| Electron 安全 | [reviews/electron_review.md](electron_review.md) |
| 部署 DevOps | [reviews/devops_review.md](devops_review.md) |
| 架构与测试 | [reviews/architecture_review.md](architecture_review.md) |

---

*由 CHS Agent Teams v3.0 编排生成 | 5 路并发评审 | 评审引擎: claude-sonnet-4-6*
