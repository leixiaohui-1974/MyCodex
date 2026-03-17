# MyCodex HydroSIS Architecture Design

> Version: v1.0 | Date: 2026-03-16
> Author: CHS Agent Teams Chief Architect

---

## 0. Design Principles

- **Pragmatic First**: All deployment must be docker compose up -d
- **Minimal Changes**: Reuse existing main.js and App.tsx
- **Incremental**: Four Phases, each independently deliverable
- **Monolith First**: One Node process; no microservices

---

## 1. Overall Architecture

### 1.1 Overview

```
+-------------------------------------------------------------------+
|                     User Devices                                   |
|  +----------------+  +----------------+  +---------------------+  |
|  | Electron       |  | Browser Web    |  | lzc-client-desktop  |  |
|  | (Windows/Mac)  |  | (Any device)   |  | (LazyCat client)    |  |
|  +-------+--------+  +-------+--------+  +----------+----------+  |
|          |                    |                       |             |
+----------+--------------------+-----------------------+-------------+
           | IPC (local)        | HTTPS                 | HTTPS
+----------+--------------------+-----------------------+-------------+
|          v                    v                       v             |
|  +-----------------------------------------------------------+    |
|  |              MyCodex Server (Fastify)                      |    |
|  +-----------------------------------------------------------+    |
|  +---------+  +------------+  +----------+  +--------------+      |
|  | SQLite  |  | Gitea      |  | Nginx    |  | Clash (opt)  |      |
|  +---------+  +------------+  +----------+  +--------------+      |
|                    LazyCat Server: HydroSIS                        |
+--------------------------------------------------------------------+
```
### 1.2 Key Decisions

| Item | Choice | Rationale |
|------|--------|-----------|
| Backend | Fastify | 3x faster than Express; native TS; JSON Schema |
| Database | SQLite (better-sqlite3) | Zero ops; file backup; small team |
| Realtime | WebSocket (@fastify/websocket) | Live log streaming |
| Task queue | In-memory + SQLite | No Redis needed |
| Auth | JWT + multi-provider | Unified token; stateless |
| Containers | Docker Compose | LazyCat native support |

---

## 2. Frontend-Backend Separation

### 2.1 Transport Abstraction Layer

Frontend uses a Transport abstraction that auto-detects runtime environment.

```
src/
  transport/
    types.ts          # MyCodexTransport interface
    ipc-transport.ts  # Electron IPC passthrough
    http-transport.ts # HTTP/WebSocket
    index.ts          # Auto-detect
  App.tsx             # Use transport instead of window.mycodex
```

#### transport/types.ts

```typescript
export interface MyCodexTransport {
  listProjects(root?: string): Promise<ProjectListResponse>;
  createProject(root: string, name: string): Promise<ProjectCreateResponse>;
  updateProjectManifest(path: string, manifest: ProjectManifest): Promise<ProjectUpdateResponse>;
  runTeam(payload: TeamRunPayload): Promise<CommandResult>;
  runGws(payload: ShellPayload): Promise<CommandResult>;
  runLzc(payload: ShellPayload): Promise<CommandResult>;
  deployGitea(payload: GiteaDeployPayload): Promise<CommandResult>;
  initGitTeamFlow(payload: { projectPath: string }): Promise<CommandResult>;
  bindGiteaRemote(payload: BindRemotePayload): Promise<CommandResult>;
  runGitTeamQuickFlow(payload: QuickFlowPayload): Promise<CommandResult>;
  backupGithub(payload: BackupPayload): Promise<CommandResult>;
  runtimeStatus(): Promise<RuntimeStatus>;
  listArtifacts(projectPath: string): Promise<ArtifactListResponse>;
  readArtifact(targetPath: string, projectRoot?: string): Promise<ArtifactContent>;
  startGoogleAuth(): Promise<AuthResponse>;
  startWechatAuth(): Promise<AuthResponse>;
  openFile(targetPath: string): Promise<{ ok: boolean; error?: string }>;
  onTaskOutput?(callback: (data: TaskOutputEvent) => void): () => void;
}
```

### 2.2 IPC-to-HTTP Route Mapping

| IPC Channel | HTTP | Route |
|-------------|------|-------|
| projects:list | GET | /api/projects |
| projects:create | POST | /api/projects |
| projects:update-manifest | PUT | /api/projects/:slug/manifest |
| team:run | POST | /api/team/run |
| gws:run | POST | /api/gws/run |
| lzc:run | POST | /api/lzc/run |
| gitea:deploy | POST | /api/gitea/deploy |
| git:team:init | POST | /api/git/team/init |
| git:gitea:bind-remote | POST | /api/git/remote/bind |
| git:team:quick-flow | POST | /api/git/team/quick-flow |
| backup:github | POST | /api/backup/github |
| runtime:status | GET | /api/runtime/status |
| artifacts:list | GET | /api/artifacts?project=xxx |
| artifacts:read | GET | /api/artifacts/content?path=xxx |
| - | WebSocket | /ws/tasks |

### 2.3 Backend Service Reuse

Key insight: business logic in electron/main.js has NO Electron dependency.

Strategy:
1. Move electron/shared.js -> server/lib/shared.ts
2. Move main.js business functions -> server/services/
3. Slim electron/main.js to ~50 lines of IPC glue
4. server/routes/ calls the same services

```
server/
  index.ts, lib/shared.ts
  services/project.ts, team-runner.ts, git-ops.ts, artifact.ts, shell-adapters.ts, runtime.ts
  routes/projects.ts, team.ts, git.ts, artifacts.ts, auth.ts, runtime.ts
  ws/task-stream.ts
  auth/jwt.ts, google.ts, wechat.ts, gitea.ts, guard.ts
  db/schema.sql, index.ts
```
---

## 3. LazyCat Server Deployment

### 3.1 Docker Compose

Services: mycodex-server (Fastify:3210), mycodex-web (Nginx:3211),
gitea (3000/2222), nginx (443/80 reverse proxy), clash (7890/9090, optional).

### 3.2 Data Volumes

| Volume | Path | Content |
|--------|------|---------|
| mycodex-data | /data/mycodex | Projects, Agent outputs |
| mycodex-db | /data/db | SQLite database |
| gitea-data | /data | Gitea repos and config |

---

## 4. Triple Authentication

All providers -> Identity Mapper -> internal user_id -> JWT { sub, provider, roles }.
One user can bind multiple external identities.

- **International**: Google OAuth2 + GitHub OAuth2
- **China**: WeChat QR scan + Gitee OAuth
- **Private**: Gitea local auth (OAuth2 or direct API)

### 4.2 Database Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT,
  avatar_url TEXT, role TEXT DEFAULT 'user',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE user_identities (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id),
  provider TEXT NOT NULL, external_id TEXT NOT NULL,
  metadata TEXT, created_at TEXT NOT NULL,
  UNIQUE(provider, external_id)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE, display_name TEXT,
  owner_id TEXT REFERENCES users(id), manifest TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id),
  user_id TEXT REFERENCES users(id), type TEXT, subtype TEXT,
  task_text TEXT, goal_text TEXT,
  status TEXT DEFAULT 'pending', result TEXT,
  created_at TEXT, finished_at TEXT
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY, name TEXT UNIQUE, version TEXT,
  author_id TEXT REFERENCES users(id), description TEXT,
  entry_point TEXT, config TEXT, created_at TEXT, updated_at TEXT
);
```

---

## 5. Proxy Solution

- Clash container (optional docker compose profile: proxy)
- CLASH_PROXY env var for transparent proxy on GitHub/Google API
- Git operations get HTTP_PROXY/HTTPS_PROXY env vars
- Investigate LazyCat native proxy capabilities first

---

## 6. Team Collaboration

### 6.1 Skill Registry: /api/skills (GET, POST, PUT, DELETE, POST :id/invoke)
### 6.2 Task Queue: In-memory + SQLite, max 2 concurrent, WebSocket live output
### 6.3 Permissions: admin / member / viewer
### 6.4 Gitea WebHooks: POST /api/webhooks/gitea (push, PR, issues)

---

## 7. Roadmap

### Phase 1: Frontend-Backend Separation (2-3 weeks)
- Extract server/ services from electron/main.js
- Create src/transport/ abstraction
- Fastify routes for all 16 IPC handlers
- Deliverables: Electron + Web both work

### Phase 2: LazyCat Deploy + Web (2-3 weeks)
- Docker Compose + Nginx + Gitea
- SQLite schema + deploy.sh
- WebSocket live logs
- Deliverables: docker compose up -d; browser access works

### Phase 3: Auth + Proxy (2 weeks)
- JWT + Gitea/Google/WeChat auth
- Clash integration
- Deliverables: Three auth methods; proxy works

### Phase 4: Team + Skills (3-4 weeks)
- Task queue + Skill registry
- Gitea webhooks + permissions + UI
- Deliverables: Skills market; task queue; webhooks

---

## 8. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | Fastify 5.x | Best perf; JSON Schema; native TS |
| WebSocket | @fastify/websocket | Seamless integration |
| Database | SQLite (better-sqlite3) | Zero ops; file backup |
| Auth | JWT (@fastify/jwt) | Stateless; unified |
| Task Queue | Memory + SQLite | No Redis needed |
| Frontend | React 18 + Vite 5 | Keep existing |
| Containers | Docker Compose | Simple; no K8s |
| Reverse Proxy | Nginx | Most mature |
| VPN Proxy | Clash | Largest community |

---

## 9. Final Directory Structure

```
Y:/MyCodex/
  electron/main.ts (~50 lines IPC glue), preload.ts
  server/
    index.ts, lib/(shared.ts, proxy.ts)
    services/(project, team-runner, git-ops, artifact, shell-adapters, runtime, task-queue, skill-registry).ts
    routes/(projects, team, git, artifacts, auth, skills, webhooks, runtime).ts
    ws/task-stream.ts
    auth/(jwt, google, wechat, gitea, guard).ts
    db/(schema.sql, index.ts)
  src/
    transport/(types, ipc-transport, http-transport, index).ts
    App.tsx, main.tsx, styles.css
  deploy/
    docker-compose.yml, Dockerfile.server, Dockerfile.web
    nginx/(nginx.conf, web.conf)
    clash/config.yaml.example
    deploy.sh
```

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| LazyCat Docker too old | Pre-check; fallback compose |
| team.ps1 is PowerShell | Write team.sh (bash) wrapper; Python scripts are cross-platform; Codex CLI is open-source Node.js and runs natively on Linux |
| WeChat review delay | Gitea first; WeChat as enhancement |
| SQLite contention | WAL mode; team < 20 is fine |
| Clash nodes expire | Multiple sources; connectivity check |

---

## 11. Decision Records

- **D-1**: Fastify over Express (Express 5 still unreleased)
- **D-2**: SQLite over PostgreSQL (team < 20; zero ops)
- **D-3**: Electron keeps IPC for MVP (embed Fastify later if needed)
- **D-4**: team.cmd/team.ps1 needs a bash wrapper (team.sh) for Linux; Codex CLI is open-source Node.js (cross-platform); Python scripts under scripts/ are already cross-platform

---

*Generated by CHS Agent Teams Chief Architect for MyCodex project team.*
