# MyCodex Desktop MVP

MyCodex is a desktop workspace around Codex CLI and embedded Agent Teams.  
This MVP includes:

- desktop UI shell (Electron + React)
- project management (create/list/switch local projects)
- per-project manifest with saved defaults, linked account state, and backup branch
- default Agent Team presets (`MVP Build`, `Research Scan`, `Docs Draft`)
- `team` launcher integration for planning/runs/resume/status
- visual result preview for markdown/html/text/json artifacts
- `GWS CLI` command runner with environment warnings
- Google login entry flow (browser-open + local account bind placeholder)
- WeChat login entry flow (browser-open + local ID bind placeholder)
- `lzc-cli` command runner and one-click Gitea deploy action
- Git team collaboration bootstrap (branch/commit/PR guide initializer)
- Gitea remote binding for private team collaboration
- GitHub backup entry with repo/remote prechecks and clearer statuses

## Run

1. Install dependencies:
   - `npm install`
2. Start dev mode:
   - `npm run dev`
3. Open desktop app only (after frontend build):
   - `npm run start`

Environment overrides:
- `MYCODEX_PROJECTS_ROOT`
- `MYCODEX_TEAM_LAUNCHER`

## Notes

- Agent Teams launcher path resolution order:
  - env override: `MYCODEX_TEAM_LAUNCHER`
  - fallback: `C:\Users\lxh\.codex\skills\tri-model-collab\team.cmd`
- Default projects root:
  - `%USERPROFILE%\Documents\MyCodex\projects`
- Project metadata file:
  - `<project>\mycodex.project.json`
- Optimized Chinese team plan:
  - `docs\team-plan.zh-CN.md`
- Full OAuth token lifecycle and secure account vaulting are planned for next phase.
- GitHub backup now checks out the configured backup branch and pushes with upstream (`git push -u origin <branch>`).
- On Windows UNC workspaces, `npm install` and some Electron postinstall steps can fail because `cmd.exe` does not keep the UNC directory as cwd.
  - The npm entrypoints now delegate to PowerShell wrapper scripts under `scripts\` so `npm run dev` and `npm run build:web` do not rely on `cmd.exe` preserving the UNC cwd.
  - If dependencies were installed incompletely from a UNC path, reinstall on a mapped drive or local path first. This workspace currently lacks `node_modules\electron` and has an incomplete Vite install.
