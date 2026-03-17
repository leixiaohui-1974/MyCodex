# MyCodex 后端代码质量评审报告

**评审日期**: 2026-03-17
**评审员**: CHS Agent Teams 多引擎评审专家
**评审范围**: server/ 目录全量后端代码
**评审版本**: package.json v0.1.0

---

## 总体评分

| 维度 | 评分 | 备注 |
|------|------|------|
| API 设计规范性 | 6/10 | 缺少统一版本号、认证覆盖不全 |
| 错误处理 | 6/10 | 部分路由缺失 try/catch，错误信息泄露内部路径 |
| 安全性 | 4/10 | 多处路径遍历、未认证端点、JWT 双实例冲突 |
| 数据库设计 | 7/10 | 结构合理，少量 NOT NULL 约束缺失 |
| WebSocket 管理 | 8/10 | 整体较好，缺少认证 |
| 代码组织与可维护性 | 7/10 | 结构清晰，shared.ts 过重 |

---

## 严重问题（必须修复）

### SEC-01: JWT 双实例冲突导致签名验证混乱

**文件**: server/index.ts L4,L15 / server/auth/jwt.ts L1,L13-18

index.ts 同时注册了 @fastify/jwt（读取环境变量 MYCODEX_JWT_SECRET）和手动引入的 jsonwebtoken（读取 JWT_SECRET），两套实现读取不同的环境变量名。authGuard 调用的是自定义 verifyToken，@fastify/jwt 插件是死代码。若 JWT_SECRET 未设置则 getJwtSecret() 在运行时抛出异常，生产环境认证系统完全崩溃。

**修复方案**: 删除 @fastify/jwt 注册；统一使用 server/auth/jwt.ts 的自定义实现；将两处环境变量名合并为同一个（如 MYCODEX_JWT_SECRET）。

---

### SEC-02: 路径遍历漏洞——root 和 slug 参数未沙箱化

**文件**: server/routes/projects.ts L10,L17,L25

root 和 slug 参数均直接拼入文件系统路径，无任何范围校验：

- GET /api/projects?root=/etc 可列举任意服务器目录
- PUT /api/projects/../../etc/manifest 可向任意路径写入 manifest 文件

攻击者无需任何权限即可利用（因为 projects 路由无认证，见 SEC-03）。

**修复方案**: 对 root 使用白名单（只允许 DEFAULT_ROOT 或已配置路径）；对最终 projectPath 使用已有的 isPathWithinRoots 函数校验。

---

### SEC-03: /api/projects、/api/team/run、/api/git/* 均无认证保护

**文件**: server/routes/projects.ts、server/routes/team.ts、server/routes/git.ts

这三个路由文件均未使用 preHandler（authGuard 未挂载），匿名用户可以：

- 列举并创建项目（projects.ts）
- 触发团队 AI 命令执行（team.ts）—— runTeamCommand 调用外部可执行文件，本质上是未鉴权命令执行接口
- 执行 git 初始化、branch 切换、push 代码（git.ts）

**修复方案**: 为上述路由的每个 handler 添加 { preHandler: [authGuard] }。

---

### SEC-04: skill-registry.invoke 可加载任意本地模块（代码注入）

**文件**: server/services/skill-registry.ts L73-100

entry_point 字段存储在数据库，由 POST /api/skills（仅要求普通登录用户，无 admin 角色限制）写入。任何已登录用户可注册 entry_point 指向服务器任意 .js 文件的 Skill，然后调用 /api/skills/:id/invoke 触发动态 import()，实现任意代码执行。

**修复方案**:
1. POST /api/skills 增加 roleGuard(admin)（与 PUT/DELETE 保持一致）。
2. entry_point 必须通过 isPathWithinRoots 白名单校验，只允许在受控技能目录内。

---

### SEC-05: 微信 OAuth state 未校验（CSRF 攻击）

**文件**: server/routes/auth.ts L86-100 / server/auth/wechat.ts L26-80

getWechatQrUrl() 生成了 state 随机数，但回调路由 /api/auth/wechat/callback 从未将其与服务端存储值比对，handleWechatCallback 只检查 state 是否为非空字符串。攻击者可伪造任意 state 发起 CSRF 攻击，让受害者绑定攻击者账号。

**修复方案**: 在服务端（Session 或 Redis）存储生成的 state，回调时严格比对并删除，超时自动失效（建议 10 分钟）。

---

### SEC-06: 生产环境 JWT Secret 存在硬编码明文默认值

**文件**: server/index.ts L15

若生产部署时忘记设置 MYCODEX_JWT_SECRET，系统使用公开弱 secret mycodex-dev-secret-change-in-prod，攻击者可离线伪造任意用户的 JWT 令牌，绕过全部认证。

**修复方案**: 删除默认值，改为强制检测——若未设置则启动时立刻以非零状态码退出并打印明确错误。

---

### SEC-07: OAuth 回调将 JWT token 明文暴露在 URL 中

**文件**: server/routes/auth.ts L76,L99

Google 和 Gitea 的 OAuth 回调均使用 reply.redirect(frontendUrl + "?token=" + token) 传递 JWT。URL 中的 token 会被浏览器历史记录、服务器 access log、Referer 请求头、代理/CDN 日志全量记录，面临令牌劫持风险。

**修复方案**: 改用 HttpOnly Secure Cookie 传递 token，或使用短时 one-time code 中转。

---

### BUG-01: findOrCreate 存在竞态条件（Race Condition）

**文件**: server/routes/auth.ts L23-53

findUserByIdentity 和 createUser/createIdentity 之间没有数据库事务包裹。在并发首次登录场景下，会触发 UNIQUE 约束冲突（user_identities.provider+external_id），产生 500 错误。

**修复方案**: 用 db.transaction() 将整个 findOrCreate 函数包裹为原子操作。

---

## 建议改进

### IMPROVE-01: CORS 配置过于宽松

**文件**: server/index.ts L22 — { origin: true } 允许所有来源。生产环境应通过环境变量配置白名单域名，并仅在必要时开启 credentials: true。

---

### IMPROVE-02: 缺少 API 版本前缀

所有路由使用 /api/xxx 而无版本号，破坏性变更无法平滑过渡。建议统一添加 /api/v1/ 前缀（Fastify register 时传入 { prefix: "/api/v1" } 即可）。

---

### IMPROVE-03: 数据库 Schema 缺少 NOT NULL 约束

**文件**: server/db/schema.sql

projects 表的 display_name、created_at、updated_at，tasks 表的 type、status 等核心字段未加 NOT NULL，允许写入空值，后续查询可能出现意外行为。

---

### IMPROVE-04: WebSocket 端点缺少认证

**文件**: server/ws/task-stream.ts L46

/ws/tasks 端点无任何认证，匿名客户端可建立连接并订阅所有任务事件，存在业务数据泄露风险。建议在连接握手时解析 URL query 中的 token 并校验，校验失败则立即关闭连接。

---

### IMPROVE-05: POST /api/skills 的 author_id 由客户端提交（可伪造）

**文件**: server/routes/skills.ts L25

author_id 由请求 body 传入而非从 request.user.sub 中读取，已认证用户可将技能挂靠到其他用户名下。应取自 JWT payload，不信任客户端输入。

---

### IMPROVE-06: Skill PUT 使用先删后建，导致 ID 变更

**文件**: server/routes/skills.ts L54-64

更新 Skill 时先 unregister(id) 删除旧记录再 register(...) 创建新记录，新 ID 与旧 ID 不同，所有持有旧 ID 的外部引用均失效。应使用 UPDATE 语句原地更新并保留原始 ID。

---

### IMPROVE-07: runGitBackup 的 commit message 无长度校验

**文件**: server/services/git-ops.ts L170 — 外部传入的 message 无长度/字符过滤，超长字符串可能引发 git 异常。建议加 512 字符截断。

---

### IMPROVE-08: checkToolAvailability 使用 where 命令（仅 Windows）

**文件**: server/services/shell.ts L256 — where 是 Windows 命令，Linux/macOS 需用 which。若计划跨平台部署，需根据 process.platform 判断。

---

### IMPROVE-09: getRuntimeStatus 缓存机制无效

**文件**: server/services/shell.ts L265-286 — 结果赋给 runtimeStatusCache 但未设置 TTL，每次请求仍全量重新 spawn 4 个子进程。建议加 30 秒 TTL 避免性能浪费。

---

### IMPROVE-10: 错误响应泄露内部文件系统路径

**文件**: server/services/project.ts L27 — 错误信息中包含服务器完整路径，不应暴露给客户端，应返回通用描述（如 Project already exists）。

---

### IMPROVE-11: shared.ts 职责过于混杂（401 行）

**文件**: server/lib/shared.ts — 混合了文件系统工具、Manifest CRUD、Shell 执行、Artifact 扫描、路径安全检查、命令行解析等多种职责。建议按功能拆分为独立模块（lib/fs-utils.ts、lib/manifest.ts、lib/shell.ts、lib/path-security.ts），提升可维护性和可测试性。

---

### IMPROVE-12: 内存任务队列在服务重启时丢失 pending 任务

**文件**: server/services/task-queue.ts L22 — pendingQueue 是纯内存数组，服务重启后数据库中 status=pending 或 running 的任务不会自动恢复，造成任务静默丢失。建议启动时从数据库加载未完成任务，或将其批量标记为 failed 并通知上层。

---

## 做得好的地方

### GOOD-01: 全面使用参数化 SQL 查询

server/db/index.ts、task-queue.ts、skill-registry.ts 中所有 SQL 均使用 better-sqlite3 的 prepare().run() 参数绑定，有效防止 SQL 注入，无一处动态拼接用户输入到 SQL 语句。

### GOOD-02: Gitea Webhook 签名验证规范

server/routes/webhooks.ts 使用 crypto.timingSafeEqual 常数时间比较防止时序攻击；用正则验证签名格式；未配置 secret 时直接返回 500 拒绝。这是代码库中安全实践最好的部分。

### GOOD-03: WebSocket 连接管理有完整清理机制

server/ws/task-stream.ts 正确监听了 close/error 事件清理客户端集合；在 Fastify onClose 钩子中注销 EventEmitter 监听器并关闭所有连接，避免内存泄漏。

### GOOD-04: 文件写入使用原子操作（tmpfile + rename）

server/lib/shared.ts 的 writeManifest() 先写临时文件再 renameSync 替换，防止写入中途崩溃导致配置文件损坏，是文件系统操作的最佳实践。

### GOOD-05: Shell 执行有超时保护和输出截断

runCmd/runShell 具备 5 分钟超时 + 512KB 输出上限，防止失控进程长期占用服务器资源。

### GOOD-06: SQLite WAL 模式 + 外键约束

server/db/index.ts 启用 WAL 模式提升并发读性能，并强制开启外键约束保证数据引用完整性，两者都是 SQLite 生产部署必须项。

### GOOD-07: 路径安全工具 isPathWithinRoots 已实现且逻辑正确

server/lib/shared.ts 中该函数使用 path.resolve 消除 .. 后进行前缀比较，逻辑正确，已在 artifact.ts 中应用。只需在 projects.ts 和 git-ops.ts 中调用即可修复 SEC-02。

### GOOD-08: 部分路由使用 Fastify 泛型类型参数

skills.ts 中使用泛型参数（如 fastify.get<{ Params: { id: string } }>）为请求提供类型安全，是良好的 TypeScript 实践。

---

## 问题优先级汇总

| 编号 | 类型 | 文件 | 严重度 | 建议行动 |
|------|------|------|--------|---------|
| SEC-01 | JWT 双实例冲突 | index.ts / auth/jwt.ts | 严重 | 立即修复 |
| SEC-02 | 路径遍历漏洞 | routes/projects.ts | 严重 | 立即修复 |
| SEC-03 | 未鉴权端点 | routes/team.ts, git.ts, projects.ts | 严重 | 立即修复 |
| SEC-04 | 任意代码执行 | services/skill-registry.ts | 严重 | 立即修复 |
| SEC-05 | 微信 OAuth CSRF | routes/auth.ts / auth/wechat.ts | 严重 | 立即修复 |
| SEC-06 | 硬编码默认 secret | server/index.ts | 严重 | 立即修复 |
| SEC-07 | Token 暴露在 URL | routes/auth.ts | 高 | 本次迭代修复 |
| BUG-01 | findOrCreate 竞态 | routes/auth.ts | 高 | 本次迭代修复 |
| IMPROVE-01 | CORS 宽松 | server/index.ts | 中 | 下个迭代 |
| IMPROVE-02 | 缺 API 版本前缀 | 全局 | 中 | 下个迭代 |
| IMPROVE-03 | Schema NOT NULL 缺失 | db/schema.sql | 中 | 下个迭代 |
| IMPROVE-04 | WS 端点无认证 | ws/task-stream.ts | 中 | 下个迭代 |
| IMPROVE-05 | author_id 可伪造 | routes/skills.ts | 中 | 下个迭代 |
| IMPROVE-06 | Skill PUT 丢失 ID | routes/skills.ts | 中 | 下个迭代 |
| IMPROVE-07~12 | 其他改进项 | 多处 | 低 | 规划修复 |

---

*评审工具链: claude-sonnet-4-6 | 评审日期: 2026-03-17*
