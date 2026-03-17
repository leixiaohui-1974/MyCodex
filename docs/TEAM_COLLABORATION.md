# MyCodex Team Collaboration

## Branch Policy

- `main`: release-ready baseline
- `feat/<topic>`: feature development
- `fix/<topic>`: bug fixes
- `docs/<topic>`: documentation tracks
- `research/<topic>`: experiments and analysis

## Commit Convention

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `research: ...`
- `chore: ...`

## Pull Request Checklist

1. Include task context and expected outcome.
2. Attach relevant `team` run summary artifacts.
3. Provide validation evidence (logs, screenshots, or reports).
4. Describe known risks and rollback path.

## Protected Flow

1. Plan with `team plan` or `team run -NoExecute`.
2. Implement on a feature branch.
3. Run verification (`team run` / `team resume`).
4. Submit PR with artifacts.
5. Merge after review and backup.
