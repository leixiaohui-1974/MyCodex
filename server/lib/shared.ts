/**
 * Shared utility library extracted from electron/main.js and electron/shared.js.
 * Converted to TypeScript ESM. Business logic kept identical to the originals.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const PROJECT_MANIFEST = 'mycodex.project.json';
export const OUTPUT_LIMIT_BYTES = 512 * 1024;
export const SHELL_TIMEOUT_MS = 5 * 60 * 1000;

export const PREVIEW_EXTENSIONS: Map<string, string> = new Map([
  ['.md', 'markdown'],
  ['.markdown', 'markdown'],
  ['.html', 'html'],
  ['.htm', 'html'],
  ['.txt', 'text'],
  ['.log', 'text'],
  ['.json', 'json'],
]);

export const VALID_AUTH_STATUSES: Set<string> = new Set([
  'not_started',
  'browser_opened',
  'manually_bound',
]);

export const VALID_PRESET_IDS: Set<string> = new Set([
  'mvp_build',
  'research_scan',
  'docs_draft',
  'gitea_collab',
]);

export interface ShellResult {
  code: number;
  stdout: string;
  stderr: string;
  warnings: string[];
}

export function slugify(input: string): string {
  return (input || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/, '') || 'project';
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function safeStat(targetPath: string): fs.Stats | null {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

export function detectConflictMarkers(targetPath: string): boolean {
  let fd: number | null = null;
  try {
    fd = fs.openSync(targetPath, 'r');
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const snippet = buffer.subarray(0, bytesRead).toString('utf8');
    return /<<<<<<|CONFLICT:/u.test(snippet);
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* noop */ }
    }
  }
}

export interface Manifest {
  displayName: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  linkedAccountEmail: string;
  linkedWechatId: string;
  authStatus: string;
  giteaBaseUrl: string;
  giteaRepoUrl: string;
  selectedPresetId: string;
  backupBranch: string;
  taskDefaults: {
    teamId: string;
    taskType: string;
    subtype: string;
    task: string;
    goal: string;
  };
  [key: string]: unknown;
}

export function createDefaultManifest(displayName: string, slug: string): Manifest {
  return {
    displayName,
    slug,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    linkedAccountEmail: '',
    linkedWechatId: '',
    authStatus: 'not_started',
    giteaBaseUrl: '',
    giteaRepoUrl: '',
    selectedPresetId: 'mvp_build',
    backupBranch: 'main',
    taskDefaults: {
      teamId: `team_${slug}`,
      taskType: 'coding',
      subtype: 'docs',
      task: "请规划并实施当前项目的核心开发任务，输出可执行代码、验证步骤和风险说明。",
      goal: "完成可运行版本，并给出可复用的后续迭代方案。",
    },
  };
}

function isLikelyMojibake(value: string): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
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

export function sanitizeManifest(manifest: Partial<Manifest>, defaults: Manifest): Manifest {
  const next: Manifest = {
    ...manifest,
    taskDefaults: {
      ...defaults.taskDefaults,
      ...(manifest.taskDefaults || {}),
    },
  } as Manifest;

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

export function readManifest(projectPath: string): Manifest {
  const projectName = path.basename(projectPath);
  const manifestPath = path.join(projectPath, PROJECT_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    const manifest = createDefaultManifest(projectName, slugify(projectName));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "
", "utf8");
    return manifest;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Partial<Manifest>;
    const defaults = createDefaultManifest(
      parsed.displayName || projectName,
      parsed.slug || slugify(projectName),
    );
    const merged: Partial<Manifest> = {
      ...defaults,
      ...parsed,
      taskDefaults: {
        ...defaults.taskDefaults,
        ...(parsed.taskDefaults || {}),
      },
      updatedAt: parsed.updatedAt || nowIso(),
    };
    return sanitizeManifest(merged, defaults);
  } catch {
    return createDefaultManifest(projectName, slugify(projectName));
  }
}

export function writeManifest(projectPath: string, manifest: Partial<Manifest>): Manifest {
  const nextManifest = { ...manifest, updatedAt: nowIso() } as Manifest;
  const targetPath = path.join(projectPath, PROJECT_MANIFEST);
  const tmpPath = targetPath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(nextManifest, null, 2) + "
", "utf8");
  fs.renameSync(tmpPath, targetPath);
  return nextManifest;
}

export interface ArtifactEntry {
  name: string;
  path: string;
  ext: string;
  kind: string;
  relativePath: string;
  mtimeMs: number;
  size: number;
  hasConflict: boolean;
}

export function scanArtifacts(projectPath: string): ArtifactEntry[] {
  const root = path.resolve(projectPath);
  const results: ArtifactEntry[] = [];
  const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.next']);
  function walk(currentPath: string, depth: number): void {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(currentPath, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const targetPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) walk(targetPath, depth + 1);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      const kind = PREVIEW_EXTENSIONS.get(ext);
      if (!kind) continue;
      const stats = safeStat(targetPath);
      if (!stats) continue;
      const chk = kind === 'markdown' || kind === 'text' || kind === 'json';
      results.push({ name: entry.name, path: targetPath, ext, kind,
        relativePath: path.relative(root, targetPath), mtimeMs: stats.mtimeMs,
        size: stats.size, hasConflict: chk ? detectConflictMarkers(targetPath) : false });
    }
  }
  if (fs.existsSync(root)) walk(root, 0);
  return results.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 24);
}

export interface ArtifactContentResult {
  ok: boolean; artifact?: ArtifactEntry; content?: string;
  kind?: string; truncated?: boolean; error?: string;
}

export function readArtifactContent(targetPath: string, projectRoot?: string): ArtifactContentResult {
  const ext = path.extname(targetPath).toLowerCase();
  const kind = PREVIEW_EXTENSIONS.get(ext);
  if (!kind) return { ok: false, error: "Unsupported preview type: " + ext };
  if (!fs.existsSync(targetPath)) return { ok: false, error: 'File not found.' };
  const stats = safeStat(targetPath);
  const buffer = fs.readFileSync(targetPath);
  const truncated = buffer.length > 128 * 1024;
  const content = buffer.subarray(0, 128 * 1024).toString('utf8');
  const relativePath = projectRoot
    ? path.relative(path.resolve(projectRoot), path.resolve(targetPath))
    : path.basename(targetPath);
  return { ok: true, artifact: { name: path.basename(targetPath), path: targetPath,
    ext, kind, relativePath, mtimeMs: stats ? stats.mtimeMs : 0,
    size: stats ? stats.size : buffer.length, hasConflict: false }, content, kind, truncated };
}

export function isPathWithinRoots(targetPath: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(targetPath);
  return allowedRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
  });
}

export function parseCommandLine(commandLine: string): string[] {
  const parts = commandLine.match(new RegExp('"[^"]*"|\S+', "g")) || [];
  return parts.map((p) => p.replace(/^"|"$/g, ""));
}

export function appendCapped(current: string, chunk: string, limit = OUTPUT_LIMIT_BYTES): string {
  const next = current + chunk;
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function collectShellWarnings(out: boolean, err: boolean): string[] {
  const w: string[] = [];
  if (out) w.push('stdout truncated at 512 KB');
  if (err) w.push('stderr truncated at 512 KB');
  return w;
}

export function runShell(commandLine: string, cwd?: string, timeoutMs?: number): Promise<ShellResult> {
  const timeout = timeoutMs || SHELL_TIMEOUT_MS;
  return new Promise((resolve) => {
    const child = spawn(commandLine, { cwd, shell: true, windowsHide: true });
    let stdout = ''; let stderr = '';
    let stdoutTruncated = false; let stderrTruncated = false; let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch { /* noop */ }
    }, timeout);
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      const next = appendCapped(stdout, text, OUTPUT_LIMIT_BYTES);
      stdoutTruncated = stdoutTruncated || next.length < stdout.length + text.length;
      stdout = next;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      const next = appendCapped(stderr, text, OUTPUT_LIMIT_BYTES);
      stderrTruncated = stderrTruncated || next.length < stderr.length + text.length;
      stderr = next;
    });
    child.on("error", (error: Error) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push("Command timed out after " + (timeout / 1000) + "s");
      resolve({ code: 1, stdout, stderr: (stderr + "
" + error.message).trim(), warnings });
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push("Command timed out after " + (timeout / 1000) + "s");
      resolve({ code: code ?? 1, stdout, stderr, warnings });
    });
  });
}

export function runCmd(command: string, args: string[], cwd?: string, timeoutMs?: number): Promise<ShellResult> {
  const timeout = timeoutMs || SHELL_TIMEOUT_MS;
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = ''; let stderr = '';
    let stdoutTruncated = false; let stderrTruncated = false; let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch { /* noop */ }
    }, timeout);
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      const next = appendCapped(stdout, text, OUTPUT_LIMIT_BYTES);
      stdoutTruncated = stdoutTruncated || next.length < stdout.length + text.length;
      stdout = next;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      const next = appendCapped(stderr, text, OUTPUT_LIMIT_BYTES);
      stderrTruncated = stderrTruncated || next.length < stderr.length + text.length;
      stderr = next;
    });
    child.on("error", (error: Error) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push("Command timed out after " + (timeout / 1000) + "s");
      resolve({ code: 1, stdout, stderr: (stderr + "
" + error.message).trim(), warnings });
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      const warnings = collectShellWarnings(stdoutTruncated, stderrTruncated);
      if (timedOut) warnings.push("Command timed out after " + (timeout / 1000) + "s");
      resolve({ code: code ?? 1, stdout, stderr, warnings });
    });
  });
}

export function quoteArg(arg: string): string {
  const str = String(arg);
  if (/[\s"^%!&|<>()]/u.test(str)) {
    // Order matters: escape ^ first, then " and %, so inserted ^ chars aren't re-escaped
    const escaped = str
      .replace(/\^/g, '^^')
      .replace(/"/g, '\"')
      .replace(/%/g, '"^%"');
    return `"${escaped}"`;
  }
  return str;
}

export function mergeWarnings(...lists: Array<string[] | undefined>): string[] {
  return [...new Set(lists.flat().filter(Boolean))] as string[];
}

export function detectMissingBinary(
  tool: string,
  result: Pick<ShellResult, 'code' | 'stderr' | 'stdout'>,
  preKnownMissing = false,
): boolean {
  if (preKnownMissing) return true;
  const stderr = String(result.stderr || '');
  const stdout = String(result.stdout || '');
  if (stderr.includes("'" + tool + "'" + " is not recognized")) return true;
  if (stderr.toLowerCase().includes(tool + ": command not found")) return true;
  if (result.code !== 0 && !stdout.trim() && !stderr.trim()) return true;
  return false;
}
