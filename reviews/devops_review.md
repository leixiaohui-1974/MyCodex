# DevOps / 部署配置评审报告

**项目**: MyCodex  
**评审日期**: 2026-03-17  
**评审员**: CHS Agent Teams — 六路并发评审（安全视角 / 工程视角 / 架构视角 / 规范视角 / 逻辑视角 / DX视角）  
**评审范围**: deploy/ · scripts/ · package.json · server/package.json

---

## 评审摘要

| 维度 | 严重问题 | 建议改进 | 做得好 |
|------|---------|---------|--------|
| Docker 最佳实践 | 3 | 4 | 3 |
| 环境变量 / 安全 | 2 | 2 | 1 |
| 部署流程完整性 | 1 | 3 | 2 |
| 开发体验 (DX) | 0 | 3 | 4 |
| CI/CD | 1 | 2 | 0 |
| 依赖管理 | 1 | 2 | 2 |

---

## 严重问题（必须修复）

### RED-1  缺少 .dockerignore，.env 存在泄漏进镜像的风险

**文件**: deploy/Dockerfile.server、项目根目录  
**问题**: 项目根目录不存在 .dockerignore 文件。docker-compose.yml 中 context: .. 将整个仓库根目录作为构建上下文发送给 Docker daemon，会把 node_modules/、dist/、.env、Electron 二进制资源等全部打包进构建上下文，导致：

1. 构建速度极慢（首次可能超过数分钟）
2. .env 文件（含 JWT_SECRET、OAuth 密钥）可能被意外 COPY 进镜像层，通过 docker history 或镜像分发泄漏
3. 任意文件变更都会导致构建缓存失效

**修复**: 在项目根目录创建 .dockerignore：

    node_modules/
    dist/
    .env
    .env.*
    electron/
    *.log
    .git/
    reviews/

---

### RED-2  mycodex-server 容器以 root 身份运行

**文件**: deploy/Dockerfile.server（第1-9行）  
**问题**: 基础镜像 node:22-slim 默认以 root 运行，Dockerfile 没有创建非特权用户。若应用层存在路径穿越或命令注入漏洞，攻击者将直接获得容器内 root 权限，并可能通过 volume mount 写入宿主机 /data 目录。

**修复**: 在 build 完成后添加用户切换：

    RUN cd server && npm run build
        && addgroup --system appgroup
        && adduser --system --ingroup appgroup appuser
        && chown -R appuser:appgroup /app
    USER appuser

---

### RED-3  gitea 和 nginx 镜像使用浮动 tag，生产环境不可复现

**文件**: deploy/docker-compose.yml（第45行 gitea/gitea:latest，第62行 nginx:alpine）  
**问题**: 浮动 tag 在不同时间部署会拉取不同版本，违反生产环境可复现性原则。latest 可能引入破坏性变更，且无法回滚到已验证版本。

**修复**: 固定具体版本号，例如：

    gitea:
      image: gitea/gitea:1.22.3
    nginx:
      image: nginx:1.27-alpine

---

### RED-4  mycodex-server 和 gitea 端口直接暴露到宿主机所有网卡

**文件**: deploy/docker-compose.yml（第22-23行、第52-54行）  
**问题**: ports: - "3210:3210" 将 API 端口绑定到宿主机 0.0.0.0。在生产环境中 API 应只通过 Nginx 反向代理访问，直接暴露会绕过 Nginx 的访问控制、限速和安全头。Gitea 3000:3000 存在相同问题。

**修复**: 移除 mycodex-server 的 ports 声明（容器间已通过 mycodex-net 互联），或限制绑定地址：

    ports:
      - "127.0.0.1:3210:3210"  # 仅供本地调试，生产应删除

---

### RED-5  完全没有 CI/CD 流水线（.github/ 目录不存在）

**问题**: 项目缺少任何形式的 CI/CD 配置。当前状态下代码合并不触发自动测试，smoke.js 的 12 个测试用例从未被自动执行，镜像构建未经验证就可能进入生产，typecheck.ps1 也未纳入自动化流程。

**修复**: 创建最小化 CI 配置 .github/workflows/ci.yml：

    on: [push, pull_request]
    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with: { node-version: 22 }
          - run: npm ci
          - run: node scripts/smoke.js
          - run: cd server && npm ci && npm run build

---

### RED-6  depends_on 无健康检查，服务启动存在竞态

**文件**: deploy/docker-compose.yml（第29-30行）  
**问题**: depends_on 仅等待容器进程启动，不等待服务就绪。Gitea 初始化数据库通常需要数秒，期间 mycodex-server 若尝试连接会失败导致启动崩溃。

**修复**: 为 Gitea 添加 healthcheck 并升级 depends_on 条件：

    gitea:
      healthcheck:
        test: ["CMD", "curl", "-f", "http://localhost:3000/api/healthz"]
        interval: 10s
        timeout: 5s
        retries: 5
    mycodex-server:
      depends_on:
        gitea:
          condition: service_healthy


---

## 建议改进

### YELLOW-1  Dockerfile.server 未分离 devDependencies，镜像体积偏大

**文件**: deploy/Dockerfile.server  
npm ci 安装了包括 tsx 在内的全部依赖，但生产运行只需编译后的 dist/。建议使用多阶段构建，runtime 阶段执行 npm ci --omit=dev，可减少约 30-50% 镜像体积。

    FROM node:22-slim AS builder
    WORKDIR /app
    COPY server/package.json server/tsconfig.json ./server/
    COPY electron/shared.js ./electron/
    RUN cd server && npm ci
    COPY server/ ./server/
    RUN cd server && npm run build

    FROM node:22-slim AS runtime
    WORKDIR /app
    COPY server/package.json ./server/
    RUN cd server && npm ci --omit=dev
    COPY --from=builder /app/dist ./dist
    EXPOSE 3210
    CMD ["node", "dist/server/index.js"]

---

### YELLOW-2  Dockerfile.web 层缓存未优化

**文件**: deploy/Dockerfile.web（第4-5行）  
当前将 src/ 和依赖安装放在同一层，任何源码变更都导致 npm ci 重新执行。建议先拷贝 package.json 和 lockfile 安装依赖，再拷贝 src/：

    COPY package.json package-lock.json tsconfig.json vite.config.ts index.html ./
    RUN npm ci
    COPY src/ ./src/
    RUN npm run build:web

---

### YELLOW-3  Nginx web.conf 缺少安全响应头

**文件**: deploy/nginx/web.conf  
生产 Web 服务应添加防御性安全头：

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

---

### YELLOW-4  nginx.conf 缺少 API 限速保护

**文件**: deploy/nginx/nginx.conf  
client_max_body_size 100m 允许大体积上传，但缺少 limit_req_zone 对 API 路由的限速配置，存在被暴力请求耗尽的风险。建议对 /api/ 添加每分钟请求上限：

    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;
    # 在 /api/ location 中：
    # limit_req zone=api_limit burst=10 nodelay;

---

### YELLOW-5  deploy.sh 未检查运行时依赖是否已安装

**文件**: deploy/deploy.sh  
脚本直接执行 docker compose up，没有前置检查 docker 和 docker compose 是否已安装。在全新服务器首次部署时报错信息不友好。建议添加：

    command -v docker >/dev/null 2>&1 || { echo "Error: docker 未安装" >&2; exit 1; }
    docker compose version >/dev/null 2>&1 || { echo "Error: docker compose 插件未安装" >&2; exit 1; }

---

### YELLOW-6  team.sh 引用了不存在的 Python 脚本（悬空引用）

**文件**: deploy/team.sh（第71行）  
脚本引用 scripts/run_agent_team.py，但该文件在项目中不存在。运行时会打印"Runner script not found"退出，是一个悬空引用，应补充实现或在 README 中说明获取方式。

---

### YELLOW-7  Clash Dashboard 管理端口未限制访问来源

**文件**: deploy/docker-compose.yml（第85-86行）  
clash 服务暴露 9090:9090（Dashboard 管理端口）到所有网卡，该界面默认无需认证。即使 profiles: [proxy] 限制了默认启动，建议绑定为本地地址：

    ports:
      - "127.0.0.1:7890:7890"
      - "127.0.0.1:9090:9090"

---

### YELLOW-8  npm scripts 依赖 PowerShell，Docker 构建和 Linux CI 不兼容

**文件**: package.json（第8-13行）  
所有 npm scripts 均调用 .ps1 文件。Dockerfile.web 执行 RUN npm run build:web 在 Linux 容器中会失败（PowerShell 不存在）。注意：Dockerfile.web 实际上调用了 npm run build:web，而其对应的 .ps1 在 Linux 中无法执行，这是一个潜在的构建失败点。建议 Dockerfile 直接使用 node ./node_modules/vite/dist/node/cli.js build 替代。

---

### YELLOW-9  server/ 缺少 package-lock.json

**文件**: server/package.json  
server/ 是独立 package，若 server/package-lock.json 不存在，npm ci 会退化为 npm install，失去依赖版本锁定的可复现性保障。应在 server/ 目录执行 npm install 生成并提交 lockfile。


---

## 做得好的地方

### GREEN-1  deploy.sh 自动生成随机 JWT_SECRET

使用 openssl rand -hex 32 自动生成高熵密钥，仅在 .env 不存在时生成，不覆盖已有配置。这是一个优秀的安全默认行为，避免了使用弱默认密钥的常见错误。

---

### GREEN-2  Dockerfile.web 正确使用多阶段构建

builder 阶段使用 Node.js 编译，最终镜像仅含静态文件和 Nginx，不含 Node.js 运行时和源码，符合最小镜像原则，预计镜像体积 < 30MB。

---

### GREEN-3  Docker 网络隔离设计正确

所有服务通过具名桥接网络 mycodex-net 互联，服务间使用容器名称访问，不依赖 IP 地址，符合 Docker 网络最佳实践。

---

### GREEN-4  Nginx WebSocket 代理配置规范

nginx.conf 中 /ws/ 路由使用 map 指令正确处理 Upgrade 和 Connection 头，proxy_read_timeout 86400 支持长连接，WebSocket 代理配置无误。

---

### GREEN-5  PowerShell 脚本健壮性良好

所有 .ps1 脚本均设置 $ErrorActionPreference = "Stop" 并在执行前验证依赖工具路径是否存在，错误信息清晰明确，能防止静默失败。

---

### GREEN-6  smoke.js 覆盖核心业务场景，零外部依赖

12 个测试用例覆盖项目创建、slug 冲突检测、扫描深度限制、文件扩展名白名单、Git 冲突标记检测等核心场景，仅使用 Node.js 内置模块 assert/fs/os，可在 CI 中零配置运行。

---

### GREEN-7  数据持久化 Volume 设计清晰

为业务数据（mycodex-data）、数据库（mycodex-db）、Gitea（gitea-data）分别使用具名 volume，数据库与业务数据解耦，便于独立备份和迁移。

---

### GREEN-8  team.sh 实现 dry-run 模式

支持 -d 标志打印命令而不执行，便于在生产环境执行前预览和审计实际命令，体现了良好的运维脚本设计习惯。

---

## 优先级修复路径

**第一优先级（安全 + 数据保护，立即处理）**

- RED-1  创建 .dockerignore，防止 .env 和敏感文件泄漏进镜像
- RED-2  Dockerfile.server 添加非特权用户（USER appuser）
- RED-4  移除 mycodex-server 和 gitea 对宿主机所有网卡的端口绑定

**第二优先级（稳定性，下次部署前）**

- RED-3  固定 gitea 和 nginx 镜像版本号
- RED-6  为 depends_on 添加 healthcheck 条件判断

**第三优先级（工程质量，当前 Sprint 内）**

- RED-5  添加最小化 CI/CD 流水线（至少覆盖 smoke test + server build）
- YELLOW-1  Dockerfile.server 多阶段构建分离 devDependencies
- YELLOW-2  Dockerfile.web 优化层缓存顺序
- YELLOW-8  解决 npm scripts 跨平台不兼容问题（Dockerfile.web 构建路径）
- YELLOW-9  提交 server/package-lock.json

---

*本报告由 CHS Agent Teams 多视角评审引擎生成（安全视角 / 工程视角 / 架构视角 / 规范视角 / 逻辑视角 / DX视角），评审日期 2026-03-17。*
