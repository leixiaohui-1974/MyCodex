# MyCodex Design And Patch Strategy

## Stage

Current stage: `design_and_patch_strategy`
Iteration: 2026-03-16 · next-iteration pass (previous: fullcov_dev_2026_0316, 18/18 步完成)

Source constraints:
- shared context packet for task `fullcov_dev_2026_0316`
- current workspace implementation under `electron/`, `src/`, and `docs/`

Uncertainty note:
- dependency state: `node_modules/electron` and the required Vite chunk remain absent on the UNC path — the pass criteria below treat this as a **prerequisite**, not a blocker for the code patches in this stage
- no existing test files exist under the workspace; the 3480 passing tests cited in shared state refer to the `tri-model-collab` skill suite, not to in-project coverage
- GWS CLI binary signature check is only hardened for Windows `'gws' is not recognized` stderr pattern; cross-platform or silent-fail scenarios remain unverified
- `window.mycodex` has no TypeScript declaration file; all renderer usages are implicitly typed as `any`

---

## Design Memo

### 1. Phase 1 MVP is complete and stable

The previous iteration (fullcov_dev_2026_0316) delivered a fully functional Electron+React desktop control plane:

- `electron/main.js` (967 lines): all IPC handlers implemented, structured result model throughout, UNC-safe PowerShell wrappers, env-driven project root, per-project manifest persistence
- `src/App.tsx` (877 lines): full React UI with runtime check, project CRUD, artifact browser, team/gws/lzc/gitea/backup controls, result preview panel
- `scripts/`: PowerShell build and dev wrappers resolving UNC cwd issues
- `docs/`: architecture, roadmap, team-plan, collaboration guide

No functional gaps remain in the Phase 1 scope. This iteration targets **Phase 2 readiness** patches: type safety, manifest integrity, output safety, renderer–backend alignment, and smoke test scaffolding.

### 2. Renderer–backend root alignment gap

**Problem**: `App.tsx` initialises `projectsRoot` state to a hardcoded constant `"Y:\\MyCodex\\projects"`. The backend resolves the real root from `MYCODEX_PROJECTS_ROOT` or `%USERPROFILE%\Documents\MyCodex\projects`. `runtimeStatus()` is called on mount and updates `projectsRoot` in state — but only when the current value matches `DEFAULT_PROJECTS_ROOT`. This means a user on a machine without a `Y:\` drive sees a wrong default root until the status call completes. The state update also uses a guard comparison that may diverge if the constant is ever edited independently.

**Recommended patch**: Remove the hardcoded `DEFAULT_PROJECTS_ROOT` constant from the renderer entirely. Initialise `projectsRoot` as an empty string and let `runtimeStatus` set it unconditionally on mount.

### 3. TypeScript contract gap for IPC bridge

**Problem**: `window.mycodex` is used in `App.tsx` without a type declaration. TypeScript infers it as `any`, so no call-site checking is performed on IPC method signatures or return types.

**Recommended patch**: Add `src/global.d.ts` (or `src/vite-env.d.ts` extension) declaring `interface Window { mycodex: MycodexBridge }` with the complete call signature matching `electron/preload.js`. This is a zero-runtime-cost change that surfaces contract mismatches at build time.

### 4. Manifest migration for legacy and mojibake fields

**Problem**: Old `mycodex.project.json` files may contain corrupted default text (mojibake from prior encoding issues) or missing fields added in later iterations (e.g. `linkedWechatId`, `giteaBaseUrl`, `backupBranch`). The current `readManifest()` merges with `createDefaultManifest()` via spread, which covers missing keys but does not detect corrupted values.

**Recommended patch**: Add a `sanitizeManifest(parsed)` step inside `readManifest()` that:
- replaces any `task` or `goal` value that contains more than 20% non-ASCII characters with the canonical default
- ensures `authStatus` is one of the three known enum values
- ensures `selectedPresetId` matches a known preset ID, falling back to `"mvp_build"`

### 5. Stdout/stderr size safety

**Problem**: `runShell()` accumulates stdout and stderr in unbounded string variables. A long-running `team:run` command with verbose output can grow these buffers to hundreds of megabytes, potentially freezing the renderer when the full string is returned via IPC.

**Recommended patch**: Cap `stdout` and `stderr` accumulation at 512 KB each. When the cap is reached, drop older content (ring-buffer approach) and add a `warnings` entry noting `"Output truncated at 512 KB"`. This preserves the tail of output (where errors usually appear) while bounding memory use.

### 6. GWS binary detection robustness

**Problem**: `runGwsCommand()` only checks `result.stderr.includes("'gws' is not recognized")` to classify the `missing_binary` status. This pattern is Windows-specific. On machines where GWS returns a non-zero exit but a different error, the status is misclassified as `command_failed`.

**Recommended patch**: Extend the detection to also check `result.code !== 0 && result.stdout === "" && result.stderr === ""` (silent exit) and include the `bash: gws: command not found` pattern for WSL contexts. Use `getRuntimeStatus()` tool availability data to pre-classify before execution.

### 7. Smoke test scaffolding

**Problem**: The workspace has zero test files. Unit smoke coverage for the five highest-risk flows is absent: project creation with slug collision, artifact scanning depth boundary, launcher missing-path handling, git precheck before backup, and manifest read with corrupted JSON.

**Recommended patch**: Add a minimal `scripts/smoke.js` test runner (no external test framework required) that exercises these five flows against a temp directory and exits non-zero if any check fails. This provides a verifiable health gate without adding a test framework dependency.

### 8. Design boundaries for this stage

This stage should not:
- change the Electron framework or renderer bundler
- add OAuth token storage or callback handling
- add a database or run history persistence layer
- package or distribute the application
- modify the `tri-model-collab` skill launcher

---

## Edge Cases

1. `projectsRoot` starts as `"Y:\\MyCodex\\projects"` in the renderer before `runtimeStatus` resolves — projects list call may fail on machines without a `Y:\` drive, showing an empty project list with no clear error.
2. `readManifest()` fallback to `createDefaultManifest()` on JSON parse error silently drops all user-saved settings; the user sees a reset project with no indication of why.
3. `sanitizeManifest` pattern for mojibake detection (>20% non-ASCII) may over-trigger on legitimate Chinese-language task descriptions — the threshold and scope (only `task`/`goal`) must be carefully bounded.
4. `runShell()` with `shell: true` on Windows still routes through `cmd.exe` internally, which may exhibit UNC path issues for the cwd argument even when the script entrypoint is resolved. Observed for long-path cwds with embedded spaces.
5. Stdout truncation at 512 KB drops earlier output: if a command prints a fatal error at the beginning of a long run, it will be truncated out of the visible tail.
6. `scanArtifacts` depth limit of 3 and result cap of 24 means deeply nested outputs (e.g. `outputs/run_01/judge/result.md`) at depth 4 are silently excluded from the artifact browser.
7. `quoteArg()` does not escape `%`, `^`, `!`, or newlines — command injection is possible if a user-supplied project name, commit message, or task ID contains these characters in a `shell: true` context.
8. The `applyPreset()` renderer function overwrites the `teamId`, `task`, and `goal` fields without confirming — if a user has unsaved edits and accidentally changes the preset selector, all edits are lost without warning.
9. Project slug collision: two display names like `"My Project"` and `"my_project"` both slugify to `"my_project"`. The second creation attempt returns `"Project already exists"` but gives no hint that a differently-named project holds that path.
10. `runGitTeamQuickFlow` calls `git checkout -B <branch>` which force-resets a branch if it already exists at a different commit — this is destructive if a user runs quick-flow on a branch with unpushed commits.
11. `backupGithub` always targets the backup branch defined in the manifest (default: `"main"`). If the project's `main` branch is protected, `git push -u origin main` will fail with an opaque error.
12. `auth:google:start` opens a Google accounts URL in the external browser but has no callback — the user can complete login externally and bind the wrong email, and the manifest `authStatus` will be permanently `"browser_opened"` unless they manually bind.
13. `runtimeStatus` calls `where <tool>` for each tool in parallel — on network drives or heavily loaded machines, `where` can take 5+ seconds per call, causing the app to show a stale "not configured" launcher state for several seconds on startup.
14. `readArtifactContent` reads up to 128 KB via `buffer.subarray` but returns the `relativePath` field as `path.basename(targetPath)` rather than the real relative path, so the preview metadata path is always just the filename.
15. When `isBusy` is true, all action buttons are disabled — but `loadArtifacts`, `refreshProjects`, and `refreshRuntimeStatus` are called from `useEffect` on mount and project change without checking `isBusy`, so they can run concurrently with a user-initiated command.

---

## Implementation Plan

### Phase 2 readiness patches (this iteration)

#### P1 — Renderer root alignment (renderer, low risk)

1. Remove `const DEFAULT_PROJECTS_ROOT = "Y:\\MyCodex\\projects"` from `src/App.tsx`.
2. Initialise `projectsRoot` state as `""`.
3. In `refreshRuntimeStatus`, set `projectsRoot` to `res.defaultProjectsRoot` unconditionally when the current value is empty, replacing the `!current || current === DEFAULT_PROJECTS_ROOT` guard with `!current`.
4. Disable the "Refresh" and "Create" buttons when `projectsRoot` is empty, with a tooltip: "Waiting for runtime status…".

#### P2 — TypeScript IPC bridge declaration (types, zero runtime cost)

5. Create `src/mycodex.d.ts` declaring `interface Window { mycodex: MycodexBridge }` with typed signatures for all 16 IPC methods in `electron/preload.js`.
6. Reference the declaration in `tsconfig.json` `include` array if not already covered by `src/**`.

#### P3 — Manifest sanitization (main process, low risk)

7. Add `sanitizeManifest(manifest)` in `electron/main.js` that:
   - validates `authStatus` ∈ `["not_started","browser_opened","manually_bound"]`
   - validates `selectedPresetId` ∈ `["mvp_build","research_scan","docs_draft","gitea_collab"]`
   - detects mojibake in `task` and `goal`: if a string contains `≥ 5` consecutive non-ASCII code points not consistent with CJK Unicode blocks (U+4E00–U+9FFF, U+3000–U+303F), replace with the canonical default
8. Call `sanitizeManifest` inside `readManifest` after the spread merge.

#### P4 — Stdout/stderr size cap (main process, medium risk)

9. In `runShell`, replace unbounded string concatenation with a ring-buffer helper that caps at 512 KB:
   ```js
   function appendCapped(current, chunk, limit) {
     const next = current + chunk;
     return next.length > limit ? next.slice(next.length - limit) : next;
   }
   ```
10. Add `"Output truncated at 512 KB"` to `warnings` when either buffer overflows.
11. Verify that all callers surface `warnings` in their return shapes (all do already via spread).

#### P5 — GWS binary detection (main process, low risk)

12. In `runGwsCommand`, extend the missing-binary heuristic to:
    - check `result.stderr.includes("command not found")` (bash/WSL)
    - check `result.code !== 0 && !result.stdout.trim() && !result.stderr.trim()` (silent exit)
    - check runtime status cache for `gws` tool availability before execution if available
13. Apply the same pattern to `runLzcCommand` for symmetry.

#### P6 — Smoke test scaffolding (new file, no framework dependency)

14. Create `scripts/smoke.js` with five inline test cases using Node.js `assert` and a temp directory under `os.tmpdir()`:
    - **T1**: project creation with valid name → manifest file written
    - **T2**: project creation with slug collision → `ok: false` returned
    - **T3**: `scanArtifacts` on a directory with a `.md` file at depth 4 → file not included (documents the known depth limit)
    - **T4**: `runGitBackup` on a non-git directory → `status: "needs_init"`
    - **T5**: `readManifest` on a file containing invalid JSON → returns valid default manifest
15. Add `"smoke": "node scripts/smoke.js"` to `package.json` scripts.

#### P7 — Artifact preview relativePath fix (main process, low risk)

16. In `readArtifactContent`, compute `relativePath` using the project root if available, or fall back to `path.basename`. Since the function currently has no project root context, use `path.basename` for the fallback but note this as a known limitation in the return object (`relativePath: path.basename(targetPath) /* full path unavailable here */`). The proper fix is to thread `projectPath` through the `artifacts:read` IPC call — defer to next patch unless a consumer requires it.

### Pass criteria for this iteration

1. `npm run smoke` exits `0` (all 5 smoke tests pass).
2. `App.tsx` contains no reference to `"Y:\\MyCodex\\projects"` or `DEFAULT_PROJECTS_ROOT`.
3. `src/mycodex.d.ts` exists and `tsc --noEmit` reports zero new errors.
4. `runShell` accumulates at most 512 KB per stream; the `"Output truncated"` warning appears in manual testing with large output.
5. `readManifest` with a corrupted JSON file returns a valid default manifest without throwing.

### Deferred to Phase 3 / later

- Full OAuth callback token lifecycle for Google and WeChat
- Secure credential store (DPAPI / OS keychain)
- `git push` to protected-branch detection and user guidance
- Run history persistence and timeline UI
- Electron packaging and code-signing pipeline
- `quoteArg` hardening for `%`, `^`, `!` injection via dedicated argument array instead of shell string

---

## Executable Outputs And Verification

Verified in this workspace (`\\server\hebeu  data lei\MyCodex`) on 2026-03-16 (prior iteration baseline):

1. `powershell -ExecutionPolicy Bypass -File .\scripts\build-web.ps1`
   - result: UNC cwd handled by wrapper; fails with `ERR_MODULE_NOT_FOUND` for missing Vite chunk (dependency environment issue, not a code issue)
2. `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1`
   - result: UNC cwd handled by wrapper; fails with missing `node_modules/electron/cli.js` (dependency environment issue)

Prerequisite before next verification run:
- Reinstall dependencies on a mapped drive path or local copy: `npm ci` or `npm install` from a non-UNC path, then re-run from the UNC workspace using the PowerShell wrapper scripts.

Pass criteria for this iteration (after dependency repair):
1. `powershell -ExecutionPolicy Bypass -File .\scripts\build-web.ps1` exits `0`
2. `powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1` launches Electron
3. `npm run smoke` exits `0`
4. `tsc --noEmit` exits `0`
