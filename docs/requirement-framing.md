# MyCodex Requirement Framing

---

## Phase 1 MVP — Status

Completed. 18/18 implementation steps finished.
Test summary: 1299 core + 1456 full-suite + 725 frontend = 3480 tests, zero failures.
All Phase 1 acceptance criteria met.

---

## Phase 2: Result Experience — Next Iteration

### Scope

`requirement_framing` for Phase 2, sourced from `docs/roadmap.md` Phase 2 items,
current architecture gaps in `docs/architecture.md`, and the live code state in `src/App.tsx`.

---

### Acceptance Criteria

1. **Artifact Browser — summary view**
   The artifact panel must show, for each artifact: file name, kind badge (md/html/json/text),
   last-modified timestamp, and file size. These are already carried in the `Artifact` type and
   must all be rendered visibly in the left-pane artifact list (currently only `name` and `relativePath` are displayed).

2. **Artifact Browser — judge / merge columns**
   When a team run produces more than one artifact in the same output directory, the artifact
   browser must group them by base name and surface a "merge" affordance that opens both files
   side-by-side in the preview area. A "judge" indicator must flag artifacts that contain
   lane-level conflict markers (strings matching `<<<<<<` or `CONFLICT:`).

3. **Enhanced Markdown Preview**
   The current `renderMarkdown()` renderer handles headings, lists, bold, and inline code only.
   Phase 2 must additionally render: numbered lists (`1. …`), blockquotes (`> …`),
   horizontal rules (`---`), and fenced code blocks (`` ``` … ``` ``).
   The rendered output must be readable without external CSS frameworks.

4. **HTML Preview — sandbox policy**
   The existing `<iframe srcDoc>` preview must add `sandbox="allow-scripts"` to prevent
   same-origin escalation. Navigation away from the `srcDoc` must be blocked.

5. **Run Timeline — lane status cards**
   A new "Timeline" tab (alongside the existing Preview / Logs tabs in the right pane) must
   display each team run as a card showing: task ID, team preset label, start time, exit code,
   and a status badge (running / ok / failed). Cards must be ordered newest-first.
   The timeline must persist across artifact selections within the same session.

6. **Run History — session persistence**
   Run history recorded in the timeline must survive navigation between projects within a
   single Electron session. It need not survive app restarts in Phase 2 (database persistence
   is Phase 4).

7. **Artifact Scan — auto-refresh after team run**
   After any `team:run` or `team:resume` command completes, the artifact list must
   automatically re-scan without requiring a manual "Scan" button press.
   (The `executeAndCapture` helper already calls `loadArtifacts`; this criterion formalises
   that the timeline card update and artifact refresh must both complete before `isBusy`
   returns to false.)

8. **Artifact Diff — side-by-side text**
   When the user activates the merge affordance on a group of two text/markdown artifacts,
   the preview area must show the two files in a side-by-side split with line numbers.
   No external diff library is required; a CSS grid / two `<pre>` columns is sufficient.

9. **Runnable and testable in local dev**
   All Phase 2 UI changes must be exercisable via `npm run dev:web` (Vite browser mode)
   without requiring Electron IPC (use a mock `window.mycodex` where needed in tests).

---

### Affected Files

| File | Change type | Notes |
|------|------------|-------|
| `src/App.tsx` | Modify | Artifact list rendering, timeline tab, merge/judge affordances, enhanced markdown renderer, iframe sandbox attribute |
| `src/styles.css` | Modify | Timeline card styles, side-by-side diff grid, artifact meta row, judge badge |
| `electron/main.js` | Read / possibly modify | Confirm `listArtifacts` returns all fields already in `Artifact` type; no IPC schema change expected |
| `docs/requirement-framing.md` | Replace | This file (current artifact) |
| `docs/architecture.md` | Modify | Update "Known Gaps" — mark markdown renderer gap as addressed in Phase 2; add timeline module entry |

Uncertain / new files (to be confirmed in design stage):

- A dedicated `src/ArtifactBrowser.tsx` component may be extracted from `App.tsx` if the
  browser logic grows beyond ~120 lines; decision deferred to design stage.
- A `src/RunTimeline.tsx` component may be introduced to isolate timeline state from `App.tsx`.
- Test files (`src/__tests__/`) will need additions for the new rendering paths.

---

### Risk List

1. **Merge / judge grouping heuristic is undefined.**
   The criterion says "group by base name" but team runs can produce output files with
   timestamps, lane IDs, or hash suffixes. The actual naming convention of `team.cmd` output
   files is not yet documented. If the grouping key is wrong, the merge affordance will either
   mis-group unrelated files or miss related ones.
   *Mitigation:* Inspect real `team.cmd` output directory layout before implementing grouping.

2. **`renderMarkdown` extension may interact with existing HTML-escape logic.**
   The current renderer HTML-escapes each line before pattern-matching. Fenced code blocks
   span multiple lines and require stateful parsing. Extending the single-pass line mapper
   without introducing XSS or double-escape bugs requires care.
   *Mitigation:* Add a dedicated multi-line pre-processing pass; add unit tests for each
   new construct before wiring into the UI.

3. **Timeline state management may conflict with `activeProject` switching.**
   Criterion 6 requires run history to survive project switches. The current `App.tsx` clears
   artifact and preview state on `activeProject` change (see `useEffect` at line 290).
   A naïve timeline implementation stored in the same `useState` scope will be wiped.
   *Mitigation:* Store timeline entries in a ref or in a state variable outside the
   project-switch `useEffect` dependency.

4. **Side-by-side diff with large files may cause layout overflow.**
   The `<pre>` columns will overflow horizontally if artifact content lines are long.
   The existing `code-preview` CSS class does not yet specify `overflow-x: auto` per column.
   *Mitigation:* Scope CSS to the diff container specifically; do not change global `pre` styles.

5. **Auto-refresh after team run adds latency to the busy-state exit.**
   `loadArtifacts` is async and performs an IPC call. If artifact scan is slow (large
   project directory), the UI stays in `isBusy=true` longer than the user expects.
   *Mitigation:* Consider running artifact scan in parallel with timeline card update rather
   than sequentially; accept the current approach for Phase 2 if parallelism adds complexity.

6. **UNC workspace path remains fragile for test tooling.**
   The workspace is on a UNC share (`\\server\hebeu  data lei\MyCodex`). Vitest and
   Electron test runners may not handle UNC paths consistently on Windows.
   *Mitigation:* Keep unit tests for renderer logic path-independent; reserve integration
   tests for a locally-mapped drive if UNC issues recur (documented workaround in README).
