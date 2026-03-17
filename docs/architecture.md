# MyCodex MVP Architecture

## Runtime

- Desktop shell: Electron
- UI: React + Vite
- Local orchestration: Node child-process calls to `team.cmd`
- Data: file-based workspace layout under `Y:\MyCodex`

## Main Modules

1. UI Shell
- left pane: project management
- center pane: task control and integrations
- right pane: execution logs and output preview

2. Team Runner Gateway
- IPC handler `team:run`
- wraps command execution for:
  - `run`
  - `resume`
  - `plan`
  - `status`
  - `open`

3. Project Service
- list/create projects in `Y:\MyCodex\projects`
- persist `mycodex.project.json` for task defaults, auth state, backup target, and preset selection
- later extension: task history timeline and richer workspace metadata

4. Backup Service
- IPC handler `backup:github`
- prechecks repo and remote state, then executes:
  - `git add -A`
  - `git commit -m "<message>"`
  - `git push`

5. Result Preview Service
- scans bounded previewable artifacts under the active project
- supports:
  - markdown
  - html
  - text/log
  - json
- includes merge-oriented grouped artifact view and lane conflict marker hints
- provides a session-level run timeline tab (running/ok/failed)

6. GWS CLI Adapter
- IPC handler `gws:run`
- executes a user-supplied command line in the active project workspace
- returns structured warnings when `gws` is missing from `PATH`

7. Auth Entry
- IPC handler `auth:google:start`
- IPC handler `auth:wechat:start`
- opens Google/WeChat login in external browser
- MVP stores account email, WeChat ID, and auth status in project metadata

8. LZC + Gitea Adapter
- IPC handler `lzc:run`
- IPC handler `gitea:deploy`
- supports one-click private Gitea bootstrap on lazy micro-server routes

9. Team Git Collaboration Adapter
- IPC handler `git:team:init`
- IPC handler `git:gitea:bind-remote`
- initializes collaboration guide and binds private Gitea remotes

## Agent Teams Integration

- Uses existing launcher:
  - `C:\Users\lxh\.codex\skills\tri-model-collab\team.cmd`
- Default flow:
  - CLI-first
  - auto-merge enabled
  - apply mode
  - merge timeout scale 4
- Built-in presets:
  - `MVP Build`
  - `Research Scan`
  - `Docs Draft`
  - `团队协作 / Gitea`

## Known Gaps

- no secure token vault yet
- no structured run history database yet
- no role-based policy layer for backup/auth
- no full OAuth callback/token lifecycle for Google/WeChat yet
- UNC shared-directory installs remain fragile for Electron dependency setup on Windows
