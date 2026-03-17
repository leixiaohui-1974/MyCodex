const { app, BrowserWindow, ipcMain, shell } = require("electron");
const {
  appendCapped,
  collectShellWarnings,
  createDefaultManifest,
  detectConflictMarkers,
  detectMissingBinary,
  ensureDir,
  isLikelyMojibake,
  isPathWithinRoots,
  nowIso,
  OUTPUT_LIMIT_BYTES,
  PREVIEW_EXTENSIONS,
  PROJECT_MANIFEST,
  quoteArg,
  readArtifactContent,
  readManifest,
  runCmd,
  runShell,
  safeStat,
  sanitizeManifest,
  scanArtifacts,
  SHELL_TIMEOUT_MS,
  slugify,
  writeManifest
} = require("./shared");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TEAM_LAUNCHER_ENV = "MYCODEX_TEAM_LAUNCHER";
const TEAM_LAUNCHER_CANDIDATES = [
  process.env[TEAM_LAUNCHER_ENV],
  path.join(os.homedir(), ".codex", "skills", "tri-model-collab", "team.cmd")
].filter(Boolean);
const PROJECTS_ROOT_ENV = "MYCODEX_PROJECTS_ROOT";
const DEFAULT_PROJECTS_ROOT =
  process.env[PROJECTS_ROOT_ENV] || path.join(os.homedir(), "Documents", "MyCodex", "projects");
const ALLOWED_AUTH_URLS = [
  "https://accounts.google.com/",
  "https://accounts.google.com/signin/v2/identifier",
  "https://open.weixin.qq.com/"
];
const SAFE_OPEN_EXTENSIONS = new Set([
  ".md", ".markdown", ".html", ".htm", ".txt", ".log", ".json",
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".csv"
]);
let runtimeStatusCache = null;

function resolveTeamLauncher() {
  return TEAM_LAUNCHER_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || "";
}

function normalizeProject(projectPath) {
  return {
    name: path.basename(projectPath),
    path: projectPath,
    manifest: readManifest(projectPath)
  };
}

function getCachedToolAvailability(tool) {
  return runtimeStatusCache?.tools?.find((item) => item.tool === tool) || null;
}

function mergeWarnings(...lists) {
  return [...new Set(lists.flat().filter(Boolean))];
}

/** Parse a simple command line into [binary, ...args] for safe execution. */
function parseCommandLine(commandLine) {
  const parts = commandLine.match(/"[^"]*"|\S+/g) || [];
  return parts.map((p) => p.replace(/^"|"$/g, ""));
}

async function runTeamCommand(payload) {
  const launcherPath = resolveTeamLauncher();
  if (!launcherPath) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: [
        `team launcher not found. Set ${TEAM_LAUNCHER_ENV} or install tri-model-collab skill under ~/.codex/skills/`
      ],
      status: "missing_launcher",
      artifacts: scanArtifacts(payload.cwd || DEFAULT_PROJECTS_ROOT)
    };
  }

  const args = [
    payload.command || "run",
    "-Type",
    payload.type || "writing",
    "-Subtype",
    payload.subtype || "docs",
    "-Workspace",
    payload.workspace || DEFAULT_PROJECTS_ROOT,
    "-Task",
    payload.task || "Untitled task",
    "-Goal",
    payload.goal || "Complete task",
    "-AutoMergeMode",
    payload.autoMergeMode || "apply",
    "-MergeTimeoutScale",
    String(payload.mergeTimeoutScale || 4)
  ];

  if (payload.id) {
    args.push("-Id", payload.id);
  }
  if (payload.parallel) {
    args.push("-Parallel", "-MaxWorkers", String(payload.maxWorkers || 2));
  }
  if (payload.noAutoMerge) {
    args.push("-NoAutoMerge");
  }

  const result = await runCmd(launcherPath, args, payload.cwd || process.cwd());
  return {
    ok: result.code === 0,
    ...result,
    command: launcherPath,
    args,
    warnings: result.warnings || [],
    status: result.code === 0 ? "success" : "command_failed",
    artifacts: scanArtifacts(payload.cwd || DEFAULT_PROJECTS_ROOT)
  };
}

async function runGwsCommand(payload) {
  const commandLine = String(payload.commandLine || "").trim();
  if (!commandLine) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["No GWS command provided."],
      status: "missing_command",
      artifacts: []
    };
  }
  const gwsStatus = getCachedToolAvailability("gws");
  const preKnownMissing = gwsStatus?.found === false;
  if (preKnownMissing) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["GWS CLI is not installed or not available on PATH."],
      status: "missing_binary",
      artifacts: scanArtifacts(payload.cwd || DEFAULT_PROJECTS_ROOT)
    };
  }
  const parsed = parseCommandLine(commandLine);
  const binary = parsed[0] || "gws";
  const cmdArgs = parsed.slice(1);
  // Validate the binary name starts with "gws" to prevent arbitrary command execution
  if (!/^gws/i.test(path.basename(binary))) {
    return {
      ok: false, code: 1, stdout: "", stderr: "",
      warnings: ["Only GWS commands are allowed."],
      status: "invalid_command", artifacts: []
    };
  }
  const result = await runCmd(binary, cmdArgs, payload.cwd || process.cwd());
  const warnings = [...(result.warnings || [])];
  if (detectMissingBinary("gws", result, preKnownMissing)) {
    warnings.push("GWS CLI is not installed or not available on PATH.");
  }
  return {
    ok: result.code === 0,
    ...result,
    command: binary,
    args: cmdArgs,
    warnings,
    status: result.code === 0 ? "success" : warnings.length ? "missing_binary" : "command_failed",
    artifacts: scanArtifacts(payload.cwd || DEFAULT_PROJECTS_ROOT)
  };
}

async function runLzcCommand(payload) {
  const commandLine = String(payload.commandLine || "").trim();
  if (!commandLine) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["No lzc command provided."],
      status: "missing_command",
      artifacts: []
    };
  }
  const lzcStatus = getCachedToolAvailability("lzc");
  const preKnownMissing = lzcStatus?.found === false;
  if (preKnownMissing) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["lzc-cli is not installed or not available on PATH."],
      status: "missing_binary",
      artifacts: scanArtifacts(payload.cwd || DEFAULT_PROJECTS_ROOT)
    };
  }
  const parsed = parseCommandLine(commandLine);
  const binary = parsed[0] || "lzc";
  const cmdArgs = parsed.slice(1);
  if (!/^lzc/i.test(path.basename(binary))) {
    return {
      ok: false, code: 1, stdout: "", stderr: "",
      warnings: ["Only lzc commands are allowed."],
      status: "invalid_command", artifacts: []
    };
  }
  const result = await runCmd(binary, cmdArgs, payload.cwd || process.cwd());
  const warnings = [...(result.warnings || [])];
  if (detectMissingBinary("lzc", result, preKnownMissing)) {
    warnings.push("lzc-cli is not installed or not available on PATH.");
  }
  return {
    ok: result.code === 0,
    ...result,
    command: binary,
    args: cmdArgs,
    warnings,
    status: result.code === 0 ? "success" : warnings.length ? "missing_binary" : "command_failed",
    artifacts: scanArtifacts(payload.cwd || DEFAULT_PROJECTS_ROOT)
  };
}

async function deployGitea(payload) {
  const cwd = payload.cwd || process.cwd();
  const appName = payload.appName || "gitea";
  const image = payload.image || "gitea/gitea:latest";
  const steps = [];

  const check = await runCmd("lzc", ["app", "ls"], cwd);
  steps.push({ cmd: "lzc app ls", ...check });
  if (check.code !== 0 && detectMissingBinary("lzc", check, false)) {
    return {
      ok: false,
      code: check.code,
      stdout: check.stdout,
      stderr: check.stderr,
      warnings: mergeWarnings(check.warnings || [], ["lzc-cli not found. Install lzc-cli first."]),
      status: "missing_lzc",
      steps,
      artifacts: scanArtifacts(cwd)
    };
  }

  const escapedAppName = appName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exists = new RegExp(`\\b${escapedAppName}\\b`, "i").test(check.stdout);
  if (!exists) {
    const create = await runCmd("lzc", ["app", "create", appName, "--image", image], cwd);
    steps.push({ cmd: `lzc app create ${appName} --image ${image}`, ...create });
    if (create.code !== 0) {
      return {
        ok: false,
        code: create.code,
        stdout: create.stdout,
        stderr: create.stderr,
        warnings: mergeWarnings(create.warnings || [], ["Failed to create Gitea app via lzc-cli."]),
        status: "deploy_failed",
        steps,
        artifacts: scanArtifacts(cwd)
      };
    }
  }

  return {
    ok: true,
    code: 0,
    stdout: exists
      ? `Gitea app '${appName}' already exists.`
      : `Gitea app '${appName}' created successfully.`,
    stderr: "",
    warnings: check.warnings || [],
    status: exists ? "already_exists" : "deployed",
    steps,
    artifacts: scanArtifacts(cwd)
  };
}

async function initGitTeamFlow(payload) {
  const cwd = payload.projectPath;
  if (!cwd || !fs.existsSync(cwd)) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["Project path does not exist."],
      status: "missing_project",
      artifacts: []
    };
  }
  if (!isPathWithinRoots(cwd, [DEFAULT_PROJECTS_ROOT])) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }

  const outputs = [];
  const repoCheck = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  outputs.push({ cmd: "git rev-parse --is-inside-work-tree", ...repoCheck });
  if (repoCheck.code !== 0) {
    const initRes = await runCmd("git", ["init"], cwd);
    outputs.push({ cmd: "git init", ...initRes });
    if (initRes.code !== 0) {
      return {
        ok: false,
        code: initRes.code,
        stdout: initRes.stdout,
        stderr: initRes.stderr,
        warnings: ["Failed to initialize git repository."],
        status: "git_init_failed",
        steps: outputs,
        artifacts: scanArtifacts(cwd)
      };
    }
  }

  const gitignorePath = path.join(cwd, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(
      gitignorePath,
      ["node_modules", "dist", "build", ".team_*", "*.log", ".env", ".DS_Store", "Thumbs.db"].join("\n") + "\n",
      "utf8"
    );
  }

  const docsDir = path.join(cwd, "docs");
  ensureDir(docsDir);
  const collaborationPath = path.join(docsDir, "TEAM_COLLABORATION.md");
  if (!fs.existsSync(collaborationPath)) {
    fs.writeFileSync(
      collaborationPath,
      [
        "# Team Collaboration Guide",
        "",
        "## Branch Strategy",
        "- `main`: stable releases",
        "- `feat/<topic>`: feature branches",
        "- `fix/<topic>`: bug fix branches",
        "",
        "## Commit Convention",
        "- `feat: ...` new feature",
        "- `fix: ...` bug fix",
        "- `docs: ...` documentation",
        "- `chore: ...` maintenance",
        "",
        "## PR Checklist",
        "- Team plan reviewed",
        "- Agent run summary attached",
        "- Tests or validation logs attached",
        "- Risks and rollback plan documented"
      ].join("\n") + "\n",
      "utf8"
    );
  }

  const addRes = await runCmd("git", ["add", "-A"], cwd);
  outputs.push({ cmd: "git add -A", ...addRes });
  const commitRes = await runCmd("git", ["commit", "-m", "chore: initialize team collaboration workflow"], cwd);
  outputs.push({ cmd: "git commit -m chore: initialize team collaboration workflow", ...commitRes });

  // R-1: Correctly handle commit failure vs "nothing to commit"
  const nothingToCommit =
    commitRes.code !== 0 && /nothing to commit|working tree clean/iu.test(`${commitRes.stdout}\n${commitRes.stderr}`);
  if (nothingToCommit) {
    return {
      ok: true,
      code: 0,
      stdout: "Git team collaboration workflow already initialized.",
      stderr: "",
      warnings: ["Team workflow files already initialized."],
      status: "initialized",
      steps: outputs,
      artifacts: scanArtifacts(cwd)
    };
  }
  if (commitRes.code !== 0) {
    return {
      ok: false,
      code: commitRes.code,
      stdout: commitRes.stdout,
      stderr: commitRes.stderr,
      warnings: ["Git commit failed during team flow initialization."],
      status: "commit_failed",
      steps: outputs,
      artifacts: scanArtifacts(cwd)
    };
  }

  return {
    ok: true,
    code: 0,
    stdout: "Git team collaboration workflow initialized.",
    stderr: "",
    warnings: [],
    status: "initialized",
    steps: outputs,
    artifacts: scanArtifacts(cwd)
  };
}

async function bindGiteaRemote(payload) {
  const cwd = payload.projectPath;
  const remoteUrl = String(payload.remoteUrl || "").trim();
  const remoteName = payload.remoteName || "origin";
  if (!cwd || !fs.existsSync(cwd)) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["Project path does not exist."],
      status: "missing_project",
      artifacts: []
    };
  }
  if (!isPathWithinRoots(cwd, [DEFAULT_PROJECTS_ROOT])) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }
  if (!remoteUrl) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["Remote URL is required."],
      status: "missing_remote_url",
      artifacts: scanArtifacts(cwd)
    };
  }

  const outputs = [];
  const repoCheck = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  outputs.push({ cmd: "git rev-parse --is-inside-work-tree", ...repoCheck });
  if (repoCheck.code !== 0) {
    const initRes = await runCmd("git", ["init"], cwd);
    outputs.push({ cmd: "git init", ...initRes });
  }

  const remoteList = await runCmd("git", ["remote"], cwd);
  outputs.push({ cmd: "git remote", ...remoteList });
  const hasRemote = remoteList.stdout.split(/\r?\n/).some((line) => line.trim() === remoteName);
  const remoteRes = hasRemote
    ? await runCmd("git", ["remote", "set-url", remoteName, remoteUrl], cwd)
    : await runCmd("git", ["remote", "add", remoteName, remoteUrl], cwd);
  outputs.push({
    cmd: hasRemote
      ? `git remote set-url ${remoteName} ${remoteUrl}`
      : `git remote add ${remoteName} ${remoteUrl}`,
    ...remoteRes
  });
  if (remoteRes.code !== 0) {
    return {
      ok: false,
      code: remoteRes.code,
      stdout: remoteRes.stdout,
      stderr: remoteRes.stderr,
      warnings: ["Failed to configure git remote."],
      status: "remote_config_failed",
      steps: outputs,
      artifacts: scanArtifacts(cwd)
    };
  }

  return {
    ok: true,
    code: 0,
    stdout: `Remote '${remoteName}' configured: ${remoteUrl}`,
    stderr: "",
    warnings: [],
    status: hasRemote ? "remote_updated" : "remote_added",
    steps: outputs,
    artifacts: scanArtifacts(cwd)
  };
}

async function runGitTeamQuickFlow(payload) {
  const cwd = payload.projectPath;
  const topic = String(payload.topic || "").trim() || "update";
  const commitType = String(payload.commitType || "feat").trim();
  const summary = String(payload.summary || "team update").trim();
  const branchPrefix = String(payload.branchPrefix || "feat").trim();
  const remoteName = String(payload.remoteName || "origin").trim();
  const branch = `${branchPrefix}/${slugify(topic)}`;
  const commitMessage = `${commitType}: ${summary}`;

  if (!cwd || !fs.existsSync(cwd)) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["Project path does not exist."],
      status: "missing_project",
      artifacts: []
    };
  }
  if (!isPathWithinRoots(cwd, [DEFAULT_PROJECTS_ROOT])) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }

  const steps = [];
  const repoCheck = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  steps.push({ cmd: "git rev-parse --is-inside-work-tree", ...repoCheck });
  if (repoCheck.code !== 0) {
    return {
      ok: false,
      code: repoCheck.code,
      stdout: repoCheck.stdout,
      stderr: repoCheck.stderr,
      warnings: ["Project is not a git repository. Run 'Init Team Git Flow' first."],
      status: "needs_init",
      steps,
      artifacts: scanArtifacts(cwd)
    };
  }

  const remoteCheck = await runCmd("git", ["remote"], cwd);
  steps.push({ cmd: "git remote", ...remoteCheck });
  const hasRemote = remoteCheck.stdout.split(/\r?\n/).some((line) => line.trim() === remoteName);
  if (!hasRemote) {
    return {
      ok: false,
      code: 1,
      stdout: remoteCheck.stdout,
      stderr: remoteCheck.stderr,
      warnings: [`Remote '${remoteName}' not found. Bind Gitea remote first.`],
      status: "missing_remote",
      steps,
      artifacts: scanArtifacts(cwd)
    };
  }

  // Check if branch exists to avoid force-resetting with -B (which discards unpushed commits)
  const branchCheck = await runCmd("git", ["rev-parse", "--verify", branch], cwd);
  let checkout;
  if (branchCheck.code === 0) {
    checkout = await runCmd("git", ["checkout", branch], cwd);
    steps.push({ cmd: `git checkout ${branch}`, ...checkout });
  } else {
    checkout = await runCmd("git", ["checkout", "-b", branch], cwd);
    steps.push({ cmd: `git checkout -b ${branch}`, ...checkout });
  }
  if (checkout.code !== 0) {
    return {
      ok: false,
      code: checkout.code,
      stdout: checkout.stdout,
      stderr: checkout.stderr,
      warnings: ["Failed to create/switch branch."],
      status: "branch_failed",
      steps,
      artifacts: scanArtifacts(cwd)
    };
  }

  const addRes = await runCmd("git", ["add", "-A"], cwd);
  steps.push({ cmd: "git add -A", ...addRes });
  if (addRes.code !== 0) {
    return {
      ok: false,
      code: addRes.code,
      stdout: addRes.stdout,
      stderr: addRes.stderr,
      warnings: ["Failed to stage changes."],
      status: "add_failed",
      steps,
      artifacts: scanArtifacts(cwd)
    };
  }

  const commitRes = await runCmd("git", ["commit", "-m", commitMessage], cwd);
  steps.push({ cmd: `git commit -m ${commitMessage}`, ...commitRes });
  const nothingToCommit =
    commitRes.code !== 0 &&
    /nothing to commit|working tree clean/iu.test(`${commitRes.stdout}\n${commitRes.stderr}`);
  if (nothingToCommit) {
    return {
      ok: true,
      code: 0,
      stdout: `No changes to commit on ${branch}.`,
      stderr: commitRes.stderr,
      warnings: ["Nothing to commit. Branch was still prepared."],
      status: "nothing_to_commit",
      steps,
      artifacts: scanArtifacts(cwd)
    };
  }
  if (commitRes.code !== 0) {
    return {
      ok: false,
      code: commitRes.code,
      stdout: commitRes.stdout,
      stderr: commitRes.stderr,
      warnings: ["Commit failed."],
      status: "commit_failed",
      steps,
      artifacts: scanArtifacts(cwd)
    };
  }

  const pushRes = await runCmd("git", ["push", "-u", remoteName, branch], cwd);
  steps.push({ cmd: `git push -u ${remoteName} ${branch}`, ...pushRes });
  return {
    ok: pushRes.code === 0,
    code: pushRes.code,
    stdout: pushRes.stdout,
    stderr: pushRes.stderr,
    warnings: [],
    status: pushRes.code === 0 ? "success" : "push_failed",
    branch,
    commitMessage,
    steps,
    artifacts: scanArtifacts(cwd)
  };
}

async function runGitBackup(payload) {
  const cwd = payload.projectPath;
  const message = payload.message || `backup: ${nowIso()}`;
  const branch = String(payload.branch || "").trim() || "main";
  const remoteName = String(payload.remoteName || "origin").trim();
  const warnings = [];

  if (!cwd || !fs.existsSync(cwd)) {
    return {
      ok: false,
      code: 1,
      stdout: "",
      stderr: "",
      warnings: ["Project path does not exist."],
      status: "missing_project",
      artifacts: []
    };
  }
  if (!isPathWithinRoots(cwd, [DEFAULT_PROJECTS_ROOT])) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }

  const insideRepo = await runCmd("git", ["rev-parse", "--is-inside-work-tree"], cwd);
  if (insideRepo.code !== 0) {
    return {
      ok: false,
      code: insideRepo.code,
      stdout: insideRepo.stdout,
      stderr: insideRepo.stderr,
      warnings: ["Project is not a git repository. Initialize git and add a remote first."],
      status: "needs_init",
      artifacts: scanArtifacts(cwd)
    };
  }

  const remoteCheck = await runCmd("git", ["remote", "-v"], cwd);
  const remoteNames = remoteCheck.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
  if (!remoteNames.length) {
    return {
      ok: false,
      code: 1,
      stdout: remoteCheck.stdout,
      stderr: remoteCheck.stderr,
      warnings: ["No git remote configured. Add a GitHub remote before backup."],
      status: "missing_remote",
      artifacts: scanArtifacts(cwd)
    };
  }
  if (!remoteNames.includes(remoteName)) {
    return {
      ok: false,
      code: 1,
      stdout: remoteCheck.stdout,
      stderr: remoteCheck.stderr,
      warnings: [`Remote '${remoteName}' is not configured. Add it before backup.`],
      status: "missing_remote",
      artifacts: scanArtifacts(cwd)
    };
  }

  const outputs = [];
  // Check if backup branch exists to avoid force-resetting with -B
  const branchCheck = await runCmd("git", ["rev-parse", "--verify", branch], cwd);
  let checkoutResult;
  if (branchCheck.code === 0) {
    checkoutResult = await runCmd("git", ["checkout", branch], cwd);
    outputs.push({ cmd: `git checkout ${branch}`, ...checkoutResult });
  } else {
    checkoutResult = await runCmd("git", ["checkout", "-b", branch], cwd);
    outputs.push({ cmd: `git checkout -b ${branch}`, ...checkoutResult });
  }
  if (checkoutResult.code !== 0) {
    return {
      ok: false,
      code: checkoutResult.code,
      stdout: checkoutResult.stdout,
      stderr: checkoutResult.stderr,
      warnings: [`Failed to switch to backup branch '${branch}'.`],
      status: "checkout_failed",
      steps: outputs,
      artifacts: scanArtifacts(cwd)
    };
  }

  const addResult = await runCmd("git", ["add", "-A"], cwd);
  outputs.push({ cmd: "git add -A", ...addResult });
  if (addResult.code !== 0) {
    return { ok: false, code: addResult.code, stdout: addResult.stdout, stderr: addResult.stderr, warnings, status: "add_failed", steps: outputs, artifacts: scanArtifacts(cwd) };
  }

  const commitResult = await runCmd("git", ["commit", "-m", message], cwd);
  outputs.push({ cmd: `git commit -m ${message}`, ...commitResult });
  const nothingToCommit =
    commitResult.code !== 0 &&
    /nothing to commit|working tree clean/iu.test(`${commitResult.stdout}\n${commitResult.stderr}`);
  if (nothingToCommit) {
    warnings.push("Nothing to commit. Skipping push.");
    return {
      ok: true,
      code: 0,
      stdout: commitResult.stdout,
      stderr: commitResult.stderr,
      warnings,
      status: "nothing_to_commit",
      steps: outputs,
      artifacts: scanArtifacts(cwd)
    };
  }
  if (commitResult.code !== 0) {
    return {
      ok: false,
      code: commitResult.code,
      stdout: commitResult.stdout,
      stderr: commitResult.stderr,
      warnings,
      status: "commit_failed",
      steps: outputs,
      artifacts: scanArtifacts(cwd)
    };
  }

  const pushResult = await runCmd("git", ["push", "-u", remoteName, branch], cwd);
  outputs.push({ cmd: `git push -u ${remoteName} ${branch}`, ...pushResult });
  return {
    ok: pushResult.code === 0,
    code: pushResult.code,
    stdout: pushResult.stdout,
    stderr: pushResult.stderr,
    warnings,
    status: pushResult.code === 0 ? "success" : "push_failed",
    steps: outputs,
    artifacts: scanArtifacts(cwd)
  };
}

async function checkToolAvailability(tool) {
  const probe = await runShell(`where ${quoteArg(tool)}`, process.cwd());
  const found = probe.code === 0;
  return {
    tool,
    found,
    detail: found ? probe.stdout.split(/\r?\n/).find(Boolean) || "" : probe.stderr || probe.stdout || ""
  };
}

async function getRuntimeStatus() {
  const launcherPath = resolveTeamLauncher();
  const checks = await Promise.all([
    checkToolAvailability("git"),
    checkToolAvailability("codex"),
    checkToolAvailability("gws"),
    checkToolAvailability("lzc")
  ]);
  const status = {
    ok: true,
    defaultProjectsRoot: DEFAULT_PROJECTS_ROOT,
    launcher: {
      found: Boolean(launcherPath),
      path: launcherPath || TEAM_LAUNCHER_CANDIDATES[0] || ""
    },
    tools: checks
  };
  runtimeStatusCache = status;
  return status;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 1240,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  ensureDir(DEFAULT_PROJECTS_ROOT);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("projects:list", async (_event, rootDir) => {
  const root = rootDir || DEFAULT_PROJECTS_ROOT;
  const allowedRoots = [DEFAULT_PROJECTS_ROOT];
  if (!isPathWithinRoots(root, allowedRoots)) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }
  ensureDir(root);
  const projects = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => normalizeProject(path.join(root, entry.name)))
    .sort((left, right) => left.manifest.displayName.localeCompare(right.manifest.displayName));
  return { ok: true, projects, root };
});

ipcMain.handle("projects:create", async (_event, rootDir, name) => {
  const root = rootDir || DEFAULT_PROJECTS_ROOT;
  const allowedRoots = [DEFAULT_PROJECTS_ROOT];
  if (!isPathWithinRoots(root, allowedRoots)) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }
  ensureDir(root);
  const displayName = String(name || "").trim();
  const slug = slugify(displayName);
  const projectPath = path.join(root, slug);
  if (fs.existsSync(projectPath)) {
    return { ok: false, error: `Project already exists: ${projectPath}` };
  }
  ensureDir(projectPath);
  ensureDir(path.join(projectPath, "docs"));
  ensureDir(path.join(projectPath, "outputs"));
  writeManifest(projectPath, createDefaultManifest(displayName || slug, slug));
  return { ok: true, project: normalizeProject(projectPath) };
});

ipcMain.handle("projects:update-manifest", async (_event, projectPath, manifest) => {
  if (!projectPath || !fs.existsSync(projectPath)) {
    return { ok: false, error: "Project path does not exist." };
  }
  // S-6: Sanitize manifest before writing to prevent injection of invalid fields
  const defaults = createDefaultManifest(
    manifest.displayName || path.basename(projectPath),
    manifest.slug || slugify(path.basename(projectPath))
  );
  const sanitized = sanitizeManifest(manifest, defaults);
  writeManifest(projectPath, sanitized);
  return { ok: true, project: normalizeProject(projectPath) };
});

ipcMain.handle("team:run", async (_event, payload) => runTeamCommand(payload));

ipcMain.handle("gws:run", async (_event, payload) => runGwsCommand(payload));
ipcMain.handle("lzc:run", async (_event, payload) => runLzcCommand(payload));
ipcMain.handle("gitea:deploy", async (_event, payload) => deployGitea(payload));
ipcMain.handle("git:team:init", async (_event, payload) => initGitTeamFlow(payload));
ipcMain.handle("git:gitea:bind-remote", async (_event, payload) => bindGiteaRemote(payload));
ipcMain.handle("git:team:quick-flow", async (_event, payload) => runGitTeamQuickFlow(payload));

ipcMain.handle("backup:github", async (_event, payload) => runGitBackup(payload));
ipcMain.handle("runtime:status", async () => getRuntimeStatus());

ipcMain.handle("artifacts:list", async (_event, projectPath) => {
  if (!projectPath) {
    return { ok: false, error: "No project path provided.", artifacts: [] };
  }
  const allowedRoots = [DEFAULT_PROJECTS_ROOT];
  if (!isPathWithinRoots(projectPath, allowedRoots)) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }
  return { ok: true, artifacts: scanArtifacts(projectPath) };
});

ipcMain.handle("artifacts:read", async (_event, targetPath, projectRoot) => {
  // S-3: Validate targetPath is within project root or default projects root
  const allowedRoots = [projectRoot, DEFAULT_PROJECTS_ROOT].filter(Boolean);
  if (!isPathWithinRoots(targetPath, allowedRoots)) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }
  return readArtifactContent(targetPath, projectRoot);
});

ipcMain.handle("auth:google:start", async () => {
  // S-4: Hardcoded URL, ignore user-provided URLs to prevent protocol abuse
  await shell.openExternal("https://accounts.google.com/signin/v2/identifier");
  return {
    ok: true,
    message:
      "Google auth browser flow opened. MVP currently records account email manually after login."
  };
});

ipcMain.handle("auth:wechat:start", async () => {
  await shell.openExternal("https://open.weixin.qq.com/");
  return {
    ok: true,
    message:
      "WeChat auth browser flow opened. MVP currently records WeChat ID manually after login."
  };
});

ipcMain.handle("file:open", async (_event, targetPath) => {
  if (!targetPath) {
    return { ok: false, error: "No path provided." };
  }
  // S-5: Validate path is within projects root and has safe extension
  const resolved = path.resolve(targetPath);
  const ext = path.extname(resolved).toLowerCase();
  const isDir = safeStat(resolved)?.isDirectory();
  if (!isDir && !SAFE_OPEN_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Blocked: cannot open files with extension '${ext}'.` };
  }
  if (!isPathWithinRoots(resolved, [DEFAULT_PROJECTS_ROOT])) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }
  const result = await shell.openPath(resolved);
  return { ok: !result, error: result || undefined };
});
