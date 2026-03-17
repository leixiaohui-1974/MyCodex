const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PROJECT_MANIFEST = "mycodex.project.json";
const OUTPUT_LIMIT_BYTES = 512 * 1024;
const SHELL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max per command
const PREVIEW_EXTENSIONS = new Map([
  [".md", "markdown"],
  [".markdown", "markdown"],
  [".html", "html"],
  [".htm", "html"],
  [".txt", "text"],
  [".log", "text"],
  [".json", "json"]
]);
const VALID_AUTH_STATUSES = new Set(["not_started", "browser_opened", "manually_bound"]);
const VALID_PRESET_IDS = new Set(["mvp_build", "research_scan", "docs_draft", "gitea_collab"]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugify(input) {
  return (input || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "project";
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultManifest(displayName, slug) {
  return {
    displayName,
    slug,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    linkedAccountEmail: "",
    linkedWechatId: "",
    authStatus: "not_started",
    giteaBaseUrl: "",
    giteaRepoUrl: "",
    selectedPresetId: "mvp_build",
    backupBranch: "main",
    taskDefaults: {
      teamId: `team_${slug}`,
      taskType: "coding",
      subtype: "docs",
      task: "请规划并实施当前项目的核心开发任务，输出可执行代码、验证步骤和风险说明。",
      goal: "完成可运行版本，并给出可复用的后续迭代方案。"
    }
  };
}

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function detectConflictMarkers(targetPath) {
  let fileDescriptor = null;
  try {
    fileDescriptor = fs.openSync(targetPath, "r");
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fileDescriptor, buffer, 0, buffer.length, 0);
    const snippet = buffer.subarray(0, bytesRead).toString("utf8");
    return /<<<<<<|CONFLICT:/u.test(snippet);
  } catch {
    return false;
  } finally {
    if (fileDescriptor !== null) {
      try {
        fs.closeSync(fileDescriptor);
      } catch {
        // noop
      }
    }
  }
}

function isLikelyMojibake(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  let nonAscii = 0;
  let cjk = 0;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 127) {
      nonAscii += 1;
      if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f)) {
        cjk += 1;
      }
    }
  }
  if (!nonAscii) return false;
  const ratio = nonAscii / value.length;
  const cjkRatio = cjk / nonAscii;
  return ratio >= 0.2 && cjkRatio < 0.6;
}

function sanitizeManifest(manifest, defaultsOrName) {
  const defaults = typeof defaultsOrName === "string"
    ? createDefaultManifest(defaultsOrName, slugify(defaultsOrName))
    : defaultsOrName;
  const next = {
    ...manifest,
    taskDefaults: {
      ...defaults.taskDefaults,
      ...(manifest.taskDefaults || {})
    }
  };

  if (!VALID_AUTH_STATUSES.has(next.authStatus)) {
    next.authStatus = defaults.authStatus;
  }
  if (!VALID_PRESET_IDS.has(next.selectedPresetId)) {
    next.selectedPresetId = defaults.selectedPresetId;
  }
  if (isLikelyMojibake(next.taskDefaults.task)) {
    next.taskDefaults.task = defaults.taskDefaults.task;
  }
  if (isLikelyMojibake(next.taskDefaults.goal)) {
    next.taskDefaults.goal = defaults.taskDefaults.goal;
  }

  return next;
}

function readManifest(projectPath) {
  const projectName = path.basename(projectPath);
  const manifestPath = path.join(projectPath, PROJECT_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    const manifest = createDefaultManifest(projectName, slugify(projectName));
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifest;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const defaults = createDefaultManifest(parsed.displayName || projectName, parsed.slug || slugify(projectName));
    const merged = {
      ...defaults,
      ...parsed,
      taskDefaults: {
        ...defaults.taskDefaults,
        ...(parsed.taskDefaults || {})
      },
      updatedAt: parsed.updatedAt || nowIso()
    };
    return sanitizeManifest(merged, defaults);
  } catch {
    return createDefaultManifest(projectName, slugify(projectName));
  }
}

function writeManifest(projectPath, manifest) {
  const nextManifest = {
    ...manifest,
    updatedAt: nowIso()
  };
  const targetPath = path.join(projectPath, PROJECT_MANIFEST);
  const tmpPath = `${targetPath}.tmp`;
  // Atomic write: write to temp file then rename to prevent corruption on crash
  fs.writeFileSync(tmpPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, targetPath);
  return nextManifest;
}

function scanArtifacts(projectPath) {
  const root = path.resolve(projectPath);
  const results = [];
  const ignoreDirs = new Set([".git", "node_modules", "dist", "build", ".next"]);

  function walk(currentPath, depth) {
    if (depth > 5) return;
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return; // Permission denied or inaccessible directory
    }
    for (const entry of entries) {
      const targetPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          walk(targetPath, depth + 1);
        }
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      const kind = PREVIEW_EXTENSIONS.get(ext);
      if (!kind) continue;
      const stats = safeStat(targetPath);
      if (!stats) continue;
      const shouldCheckConflict = kind === "markdown" || kind === "text" || kind === "json";
      results.push({
        name: entry.name,
        path: targetPath,
        ext,
        kind,
        relativePath: path.relative(root, targetPath),
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        hasConflict: shouldCheckConflict ? detectConflictMarkers(targetPath) : false
      });
    }
  }

  if (fs.existsSync(root)) {
    walk(root, 0);
  }

  return results.sort((left, right) => right.mtimeMs - left.mtimeMs).slice(0, 24);
}

function readArtifactContent(targetPath, projectRoot) {
  const ext = path.extname(targetPath).toLowerCase();
  const kind = PREVIEW_EXTENSIONS.get(ext);
  if (!kind) {
    return { ok: false, error: `Unsupported preview type: ${ext}` };
  }
  if (!fs.existsSync(targetPath)) {
    return { ok: false, error: "File not found." };
  }
  const stats = safeStat(targetPath);
  const buffer = fs.readFileSync(targetPath);
  const truncated = buffer.length > 128 * 1024;
  const content = buffer.subarray(0, 128 * 1024).toString("utf8");
  const relativePath = projectRoot
    ? path.relative(path.resolve(projectRoot), path.resolve(targetPath))
    : path.basename(targetPath);
  return {
    ok: true,
    artifact: {
      name: path.basename(targetPath),
      path: targetPath,
      ext,
      kind,
      relativePath,
      mtimeMs: stats ? stats.mtimeMs : 0,
      size: stats ? stats.size : buffer.length
    },
    content,
    kind,
    truncated
  };
}

function appendCapped(current, chunk, limit) {
  const next = current + chunk;
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function collectShellWarnings(stdoutTruncated, stderrTruncated) {
  const warnings = [];
  if (stdoutTruncated) {
    warnings.push("stdout truncated at 512 KB");
  }
  if (stderrTruncated) {
    warnings.push("stderr truncated at 512 KB");
  }
  return warnings;
}

function isPathWithinRoots(targetPath, allowedRoots) {
  const resolved = path.resolve(targetPath);
  return allowedRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
  });
}

function runShell(commandLine, cwd, timeoutMs) {
  const timeout = timeoutMs || SHELL_TIMEOUT_MS;
  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      cwd,
      shell: true,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGTERM"); } catch { /* noop */ }
    }, timeout);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      const next = appendCapped(stdout, text, OUTPUT_BUFFER_LIMIT);
      stdoutTruncated = stdoutTruncated || next.length < stdout.length + text.length;
      stdout = next;
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      const next = appendCapped(stderr, text, OUTPUT_BUFFER_LIMIT);
      stderrTruncated = stderrTruncated || next.length < stderr.length + text.length;
      stderr = next;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push(`Command timed out after ${timeout / 1000}s`);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim(), warnings });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push(`Command timed out after ${timeout / 1000}s`);
      resolve({ code: code ?? 1, stdout, stderr, warnings });
    });
  });
}

function quoteArg(arg) {
  const str = String(arg);
  if (/[\s"^%!&|<>()]/u.test(str)) {
    // Order matters: escape ^ first, then " and %, so inserted ^ chars aren't re-escaped
    const escaped = str
      .replace(/\^/g, '^^')
      .replace(/"/g, '\\"')
      .replace(/%/g, '"^%"');
    return `"${escaped}"`;
  }
  return str;
}

function runCmd(command, args, cwd, timeoutMs) {
  const timeout = timeoutMs || SHELL_TIMEOUT_MS;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGTERM"); } catch { /* noop */ }
    }, timeout);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      const next = appendCapped(stdout, text, OUTPUT_BUFFER_LIMIT);
      stdoutTruncated = stdoutTruncated || next.length < stdout.length + text.length;
      stdout = next;
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      const next = appendCapped(stderr, text, OUTPUT_BUFFER_LIMIT);
      stderrTruncated = stderrTruncated || next.length < stderr.length + text.length;
      stderr = next;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push(`Command timed out after ${timeout / 1000}s`);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim(), warnings });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push(`Command timed out after ${timeout / 1000}s`);
      resolve({ code: code ?? 1, stdout, stderr, warnings });
    });
  });
}

function detectMissingBinary(tool, result, preKnownMissing) {
  const stderr = String(result.stderr || "");
  const stdout = String(result.stdout || "");
  if (preKnownMissing) return true;
  if (stderr.includes(`'${tool}' is not recognized`)) return true;
  if (stderr.toLowerCase().includes(`${tool}: command not found`)) return true;
  if (result.code !== 0 && !stdout.trim() && !stderr.trim()) return true;
  return false;
}

module.exports = {
  OUTPUT_LIMIT_BYTES,
  PREVIEW_EXTENSIONS,
  PROJECT_MANIFEST,
  SHELL_TIMEOUT_MS,
  appendCapped,
  collectShellWarnings,
  createDefaultManifest,
  detectConflictMarkers,
  detectMissingBinary,
  ensureDir,
  isLikelyMojibake,
  isPathWithinRoots,
  nowIso,
  quoteArg,
  readArtifactContent,
  readManifest,
  runCmd,
  runShell,
  safeStat,
  sanitizeManifest,
  scanArtifacts,
  slugify,
  writeManifest
};
