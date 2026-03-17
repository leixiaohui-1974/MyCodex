import os from 'os';
import path from 'path';
import fsMod from 'fs';
import {
  runCmd,
  runShell,
  quoteArg,
  parseCommandLine,
  scanArtifacts,
  detectMissingBinary,
  mergeWarnings,
} from '../lib/shared.js';

type ToolAvailability = {
  tool: string;
  found: boolean;
  detail: string;
};

type RuntimeStatus = {
  ok: boolean;
  defaultProjectsRoot: string;
  launcher: { found: boolean; path: string };
  tools: ToolAvailability[];
};

const defaultRoot =
  process.env.MYCODEX_PROJECTS_ROOT ||
  path.join(os.homedir(), 'Documents', 'MyCodex', 'projects');

const TEAM_LAUNCHER_CANDIDATES: string[] = [
  process.env.MYCODEX_TEAM_LAUNCHER,
  path.join(os.homedir(), '.codex', 'skills', 'tri-model-collab', 'team.cmd'),
].filter(Boolean) as string[];

let runtimeStatusCache: RuntimeStatus | null = null;

function resolveTeamLauncher(): string {
  for (const candidate of TEAM_LAUNCHER_CANDIDATES) {
    if (fsMod.existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

function getCachedToolAvailability(tool: string): ToolAvailability | null {
  const found = runtimeStatusCache?.tools.find((item) => item.tool === tool);
  return found || null;
}

export async function runGwsCommand(payload: {
  commandLine?: string;
  cwd?: string;
}) {
  const commandLine = String(payload.commandLine || '').trim();

  if (!commandLine) {
    return {
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      warnings: ['No GWS command provided.'],
      status: 'missing_command',
      artifacts: [],
    };
  }

  const gwsStatus = getCachedToolAvailability('gws');
  const preKnownMissing = gwsStatus?.found === false;

  if (preKnownMissing) {
    return {
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      warnings: ['GWS CLI is not installed or not available on PATH.'],
      status: 'missing_binary',
      artifacts: scanArtifacts(payload.cwd || defaultRoot),
    };
  }

  const parsed = parseCommandLine(commandLine);
  const binary = parsed[0] || 'gws';
  const cmdArgs = parsed.slice(1);

  if (!/^gws/i.test(path.basename(binary))) {
    return {
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      warnings: ['Only GWS commands are allowed.'],
      status: 'invalid_command',
      artifacts: [],
    };
  }

  const result = await runCmd(binary, cmdArgs, payload.cwd || process.cwd());
  const warnings = [...(result.warnings || [])];

  if (detectMissingBinary('gws', result, preKnownMissing)) {
    warnings.push('GWS CLI is not installed or not available on PATH.');
  }

  return {
    ok: result.code === 0,
    ...result,
    command: binary,
    args: cmdArgs,
    warnings,
    status:
      result.code === 0
        ? 'success'
        : warnings.length
          ? 'missing_binary'
          : 'command_failed',
    artifacts: scanArtifacts(payload.cwd || defaultRoot),
  };
}

export async function runLzcCommand(payload: {
  commandLine?: string;
  cwd?: string;
}) {
  const commandLine = String(payload.commandLine || '').trim();

  if (!commandLine) {
    return {
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      warnings: ['No lzc command provided.'],
      status: 'missing_command',
      artifacts: [],
    };
  }

  const lzcStatus = getCachedToolAvailability('lzc');
  const preKnownMissing = lzcStatus?.found === false;

  if (preKnownMissing) {
    return {
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      warnings: ['lzc CLI is not installed or not available on PATH.'],
      status: 'missing_binary',
      artifacts: scanArtifacts(payload.cwd || defaultRoot),
    };
  }

  const parsed = parseCommandLine(commandLine);
  const binary = parsed[0] || 'lzc';
  const cmdArgs = parsed.slice(1);

  if (!/^lzc/i.test(path.basename(binary))) {
    return {
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      warnings: ['Only lzc commands are allowed.'],
      status: 'invalid_command',
      artifacts: [],
    };
  }

  const result = await runCmd(binary, cmdArgs, payload.cwd || process.cwd());
  const warnings = [...(result.warnings || [])];

  if (detectMissingBinary('lzc', result, preKnownMissing)) {
    warnings.push('lzc CLI is not installed or not available on PATH.');
  }

  return {
    ok: result.code === 0,
    ...result,
    command: binary,
    args: cmdArgs,
    warnings,
    status:
      result.code === 0
        ? 'success'
        : warnings.length
          ? 'missing_binary'
          : 'command_failed',
    artifacts: scanArtifacts(payload.cwd || defaultRoot),
  };
}

export async function deployGitea(payload: {
  cwd?: string;
  appName?: string;
  image?: string;
}) {
  const cwd = payload.cwd || process.cwd();
  const appName = payload.appName || 'gitea';
  const image = payload.image || 'gitea/gitea:latest';
  const steps: unknown[] = [];

  const check = await runShell('lzc app ls', cwd);
  steps.push({ cmd: 'lzc app ls', ...check });

  if (check.code !== 0 && detectMissingBinary('lzc', check, false)) {
    return {
      ok: false,
      code: check.code,
      ...check,
      warnings: mergeWarnings(check.warnings || [], ['lzc-cli not found.']),
      status: 'missing_lzc',
      steps,
      artifacts: scanArtifacts(cwd),
    };
  }

  const escapedName = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exists = new RegExp('\b' + escapedName + '\b', 'i').test(check.stdout);

  if (!exists) {
    const giteaCmd =
      'lzc app create ' + quoteArg(appName) + ' --image ' + quoteArg(image);
    const create = await runShell(giteaCmd, cwd);
    steps.push({ cmd: giteaCmd, ...create });

    if (create.code !== 0) {
      return {
        ok: false,
        code: create.code,
        ...create,
        warnings: mergeWarnings(create.warnings || [], ['Failed to create Gitea app.']),
        status: 'deploy_failed',
        steps,
        artifacts: scanArtifacts(cwd),
      };
    }
  }

  return {
    ok: true,
    code: 0,
    stdout: exists ? 'Gitea app already exists.' : 'Gitea app created successfully.',
    stderr: '',
    warnings: check.warnings || [],
    status: exists ? 'already_exists' : 'deployed',
    steps,
    artifacts: scanArtifacts(cwd),
  };
}

export async function checkToolAvailability(tool: string): Promise<ToolAvailability> {
  const probe = await runShell('where ' + quoteArg(tool), process.cwd());
  const found = probe.code === 0;
  const detail = found
    ? probe.stdout.split('\n').find(Boolean) || ''
    : probe.stderr || probe.stdout || '';

  return { tool, found, detail };
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const launcherPath = resolveTeamLauncher();
  const checks = await Promise.all([
    checkToolAvailability('git'),
    checkToolAvailability('codex'),
    checkToolAvailability('gws'),
    checkToolAvailability('lzc'),
  ]);

  const status: RuntimeStatus = {
    ok: true,
    defaultProjectsRoot: defaultRoot,
    launcher: {
      found: Boolean(launcherPath),
      path: launcherPath || TEAM_LAUNCHER_CANDIDATES[0] || '',
    },
    tools: checks,
  };

  runtimeStatusCache = status;
  return status;
}
