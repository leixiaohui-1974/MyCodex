import path from 'path';
import fsMod from 'fs';
import { runCmd, scanArtifacts, ensureDir, slugify, nowIso } from '../lib/shared.js';

const COLLAB_MD = [
  "# Team Collaboration Guide",
  "",
  "## Branch Strategy",
  "- main: stable releases",
  "- feat/<topic>: feature branches",
  "- fix/<topic>: bug fix branches",
  "",
  "## Commit Convention",
  "- feat: ... new feature",
  "- fix: ... bug fix",
  "- docs: ... documentation",
  "- chore: ... maintenance",
  "",
  "## PR Checklist",
  "- Team plan reviewed",
  "- Agent run summary attached",
  "- Tests or validation logs attached",
  "- Risks and rollback plan documented",
].join("\n") + "\n";

export async function initGitTeamFlow(payload: { projectPath: string }) {
  const cwd = payload.projectPath;
  if (!cwd || !fsMod.existsSync(cwd)) {
    return { ok: false, code: 1, stdout: "", stderr: "",
      warnings: ["Project path does not exist."], status: "missing_project", artifacts: [] };
  }
  const outputs: unknown[] = [];
  const repoCheck = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  outputs.push({ cmd: "git rev-parse --is-inside-work-tree", ...repoCheck });
  if (repoCheck.code !== 0) {
    const initRes = await runCmd("git", ["init"], cwd);
    outputs.push({ cmd: "git init", ...initRes });
    if (initRes.code !== 0) {
      return { ok: false, code: initRes.code, stdout: initRes.stdout, stderr: initRes.stderr,
        warnings: ["Failed to initialize git repository."], status: "git_init_failed",
        steps: outputs, artifacts: scanArtifacts(cwd) };
    }
  }
  const gitignorePath = path.join(cwd, ".gitignore");
  if (!fsMod.existsSync(gitignorePath)) {
    fsMod.writeFileSync(gitignorePath,
      ["node_modules","dist","build",".team_*","*.log",".env",".DS_Store","Thumbs.db"].join("\n") + "\n", "utf8");
  }
  const docsDir = path.join(cwd, "docs");
  ensureDir(docsDir);
  const collabPath = path.join(docsDir, "TEAM_COLLABORATION.md");
  if (!fsMod.existsSync(collabPath)) fsMod.writeFileSync(collabPath, COLLAB_MD, "utf8");
  const addRes = await runCmd("git", ["add", "-A"], cwd);
  outputs.push({ cmd: "git add -A", ...addRes });
  const commitRes = await runCmd("git", ["commit", "-m", "chore: initialize team collaboration workflow"], cwd);
  outputs.push({ cmd: "git commit -m chore: initialize team collaboration workflow", ...commitRes });
  const nothingToCommit = commitRes.code !== 0 &&
    /nothing to commit|working tree clean/iu.test(commitRes.stdout + "\n" + commitRes.stderr);
  if (nothingToCommit) {
    return { ok: true, code: 0, stdout: "Git team collaboration workflow already initialized.",
      stderr: "", warnings: ["Team workflow files already initialized."], status: "initialized",
      steps: outputs, artifacts: scanArtifacts(cwd) };
  }
  if (commitRes.code !== 0) {
    return { ok: false, code: commitRes.code, stdout: commitRes.stdout, stderr: commitRes.stderr,
      warnings: ["Git commit failed during team flow initialization."], status: "commit_failed",
      steps: outputs, artifacts: scanArtifacts(cwd) };
  }
  return { ok: true, code: 0, stdout: "Git team collaboration workflow initialized.",
    stderr: "", warnings: [], status: "initialized", steps: outputs, artifacts: scanArtifacts(cwd) };
}

export async function bindGiteaRemote(payload: { projectPath: string; remoteUrl: string; remoteName?: string }) {
  const cwd = payload.projectPath;
  const remoteUrl = String(payload.remoteUrl || "").trim();
  const remoteName = payload.remoteName || "origin";
  if (!cwd || !fsMod.existsSync(cwd)) {
    return { ok: false, code: 1, stdout: "", stderr: "", warnings: ["Project path does not exist."], status: "missing_project", artifacts: [] };
  }
  if (!remoteUrl) {
    return { ok: false, code: 1, stdout: "", stderr: "", warnings: ["Remote URL is required."], status: "missing_remote_url", artifacts: scanArtifacts(cwd) };
  }
  const outputs: unknown[] = [];
  const repoCheck = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  outputs.push({ cmd: "git rev-parse --is-inside-work-tree", ...repoCheck });
  if (repoCheck.code !== 0) outputs.push({ cmd: "git init", ...await runCmd("git", ["init"], cwd) });
  const remoteList = await runCmd("git", ["remote"], cwd);
  outputs.push({ cmd: "git remote", ...remoteList });
  const hasRemote = remoteList.stdout.split(/\r?\n/).some((l) => l.trim() === remoteName);
  const remoteRes = hasRemote
    ? await runCmd("git", ["remote", "set-url", remoteName, remoteUrl], cwd)
    : await runCmd("git", ["remote", "add", remoteName, remoteUrl], cwd);
  if (remoteRes.code !== 0) {
    return { ok: false, code: remoteRes.code, stdout: remoteRes.stdout, stderr: remoteRes.stderr,
      warnings: ["Failed to configure git remote."], status: "remote_config_failed", steps: outputs, artifacts: scanArtifacts(cwd) };
  }
  return { ok: true, code: 0, stdout: "Remote configured: " + remoteUrl, stderr: "", warnings: [],
    status: hasRemote ? "remote_updated" : "remote_added", steps: outputs, artifacts: scanArtifacts(cwd) };
}

export async function runGitTeamQuickFlow(payload: { projectPath: string; topic?: string; commitType?: string; summary?: string; branchPrefix?: string; remoteName?: string }) {
  const cwd = payload.projectPath;
  const topic = String(payload.topic || "").trim() || "update";
  const commitType = String(payload.commitType || "feat").trim();
  const summary = String(payload.summary || "team update").trim();
  const branchPrefix = String(payload.branchPrefix || "feat").trim();
  const remoteName = String(payload.remoteName || "origin").trim();
  const branch = branchPrefix + "/" + slugify(topic);
  const commitMessage = commitType + ": " + summary;
  if (!cwd || !fsMod.existsSync(cwd)) {
    return { ok: false, code: 1, stdout: "", stderr: "", warnings: ["Project path does not exist."], status: "missing_project", artifacts: [] };
  }
  const steps: unknown[] = [];
  const repoCheck = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  steps.push({ cmd: "git rev-parse --is-inside-work-tree", ...repoCheck });
  if (repoCheck.code !== 0) return { ok: false, code: repoCheck.code, stdout: repoCheck.stdout, stderr: repoCheck.stderr, warnings: ["Not a git repo."], status: "needs_init", steps, artifacts: scanArtifacts(cwd) };
  const remoteCheck = await runCmd("git", ["remote"], cwd);
  steps.push({ cmd: "git remote", ...remoteCheck });
  if (!remoteCheck.stdout.split(/\r?\n/).some((l) => l.trim() === remoteName)) return { ok: false, code: 1, stdout: remoteCheck.stdout, stderr: remoteCheck.stderr, warnings: ["Remote not found."], status: "missing_remote", steps, artifacts: scanArtifacts(cwd) };
  const branchCheck = await runCmd("git", ["rev-parse", "--verify", branch], cwd);
  let checkout;
  if (branchCheck.code === 0) { checkout = await runCmd("git", ["checkout", branch], cwd); steps.push({ cmd: "git checkout " + branch, ...checkout }); }
  else { checkout = await runCmd("git", ["checkout", "-b", branch], cwd); steps.push({ cmd: "git checkout -b " + branch, ...checkout }); }
  if (checkout.code !== 0) return { ok: false, code: checkout.code, stdout: checkout.stdout, stderr: checkout.stderr, warnings: ["Failed to switch branch."], status: "branch_failed", steps, artifacts: scanArtifacts(cwd) };
  const addRes = await runCmd("git", ["add", "-A"], cwd);
  steps.push({ cmd: "git add -A", ...addRes });
  if (addRes.code !== 0) return { ok: false, code: addRes.code, stdout: addRes.stdout, stderr: addRes.stderr, warnings: ["Failed to stage."], status: "add_failed", steps, artifacts: scanArtifacts(cwd) };
  const commitRes = await runCmd("git", ["commit", "-m", commitMessage], cwd);
  steps.push({ cmd: "git commit -m " + commitMessage, ...commitRes });
  const nothingToCommit = commitRes.code !== 0 && /nothing to commit|working tree clean/iu.test(commitRes.stdout + "\n" + commitRes.stderr);
  if (nothingToCommit) return { ok: true, code: 0, stdout: "No changes.", stderr: commitRes.stderr, warnings: ["Nothing to commit."], status: "nothing_to_commit", steps, artifacts: scanArtifacts(cwd) };
  if (commitRes.code !== 0) return { ok: false, code: commitRes.code, stdout: commitRes.stdout, stderr: commitRes.stderr, warnings: ["Commit failed."], status: "commit_failed", steps, artifacts: scanArtifacts(cwd) };
  const pushRes = await runCmd("git", ["push", "-u", remoteName, branch], cwd);
  steps.push({ cmd: "git push -u " + remoteName + " " + branch, ...pushRes });
  return { ok: pushRes.code === 0, code: pushRes.code, stdout: pushRes.stdout, stderr: pushRes.stderr, warnings: [], status: pushRes.code === 0 ? "success" : "push_failed", branch, commitMessage, steps, artifacts: scanArtifacts(cwd) };
}

export async function runGitBackup(payload: { projectPath: string; message?: string; branch?: string; remoteName?: string }) {
  const cwd = payload.projectPath;
  const message = payload.message || "backup: " + nowIso();
  const branch = String(payload.branch || "").trim() || "main";
  const remoteName = String(payload.remoteName || "origin").trim();
  const warnings: string[] = [];
  if (!cwd || !fsMod.existsSync(cwd)) return { ok: false, code: 1, stdout: "", stderr: "", warnings: ["Project path does not exist."], status: "missing_project", artifacts: [] };
  const insideRepo = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  if (insideRepo.code !== 0) return { ok: false, code: insideRepo.code, stdout: insideRepo.stdout, stderr: insideRepo.stderr, warnings: ["Not a git repository."], status: "needs_init", artifacts: scanArtifacts(cwd) };
  const remoteCheck = await runCmd("git", ["remote", "-v"], cwd);
  const remoteNames = remoteCheck.stdout.split(/\r?\n/).map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);

  if (!remoteNames.length) return { ok: false, code: 1, stdout: remoteCheck.stdout, stderr: remoteCheck.stderr, warnings: ["No git remote configured."], status: "missing_remote", artifacts: scanArtifacts(cwd) };
  if (!remoteNames.includes(remoteName)) return { ok: false, code: 1, stdout: remoteCheck.stdout, stderr: remoteCheck.stderr, warnings: ["Remote not configured."], status: "missing_remote", artifacts: scanArtifacts(cwd) };
  const outputs: unknown[] = [];
  const branchCheck = await runCmd("git", ["rev-parse", "--verify", branch], cwd);
  let checkoutResult;
  if (branchCheck.code === 0) { checkoutResult = await runCmd("git", ["checkout", branch], cwd); outputs.push({ cmd: "git checkout " + branch, ...checkoutResult }); }
  else { checkoutResult = await runCmd("git", ["checkout", "-b", branch], cwd); outputs.push({ cmd: "git checkout -b " + branch, ...checkoutResult }); }
  if (checkoutResult.code !== 0) return { ok: false, code: checkoutResult.code, stdout: checkoutResult.stdout, stderr: checkoutResult.stderr, warnings: ["Failed to switch to backup branch."], status: "checkout_failed", steps: outputs, artifacts: scanArtifacts(cwd) };
  const addResult = await runCmd("git", ["add", "-A"], cwd);
  outputs.push({ cmd: "git add -A", ...addResult });
  if (addResult.code !== 0) return { ok: false, code: addResult.code, stdout: addResult.stdout, stderr: addResult.stderr, warnings, status: "add_failed", steps: outputs, artifacts: scanArtifacts(cwd) };
  const commitResult = await runCmd("git", ["commit", "-m", message], cwd);
  outputs.push({ cmd: "git commit -m " + message, ...commitResult });
  const nothingToCommit = commitResult.code !== 0 && /nothing to commit|working tree clean/iu.test(commitResult.stdout + "\n" + commitResult.stderr);
  if (nothingToCommit) { warnings.push("Nothing to commit. Skipping push."); return { ok: true, code: 0, stdout: commitResult.stdout, stderr: commitResult.stderr, warnings, status: "nothing_to_commit", steps: outputs, artifacts: scanArtifacts(cwd) }; }
  if (commitResult.code !== 0) return { ok: false, code: commitResult.code, stdout: commitResult.stdout, stderr: commitResult.stderr, warnings, status: "commit_failed", steps: outputs, artifacts: scanArtifacts(cwd) };
  const pushResult = await runCmd("git", ["push", "-u", remoteName, branch], cwd);
  outputs.push({ cmd: "git push -u " + remoteName + " " + branch, ...pushResult });
  return { ok: pushResult.code === 0, code: pushResult.code, stdout: pushResult.stdout, stderr: pushResult.stderr, warnings, status: pushResult.code === 0 ? "success" : "push_failed", steps: outputs, artifacts: scanArtifacts(cwd) };
}
