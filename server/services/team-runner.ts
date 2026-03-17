import os from 'os';
import path from 'path';
import fsMod from 'fs';
import { runCmd, scanArtifacts } from '../lib/shared.js';

const TEAM_LAUNCHER_ENV = "MYCODEX_TEAM_LAUNCHER";
const TEAM_LAUNCHER_CANDIDATES = [
  process.env[TEAM_LAUNCHER_ENV],
  path.join(os.homedir(), ".codex", "skills", "tri-model-collab", "team.cmd"),
].filter(Boolean) as string[];

const defaultRoot = process.env.MYCODEX_PROJECTS_ROOT ||
  path.join(os.homedir(), "Documents", "MyCodex", "projects");

function resolveTeamLauncher(): string {
  return TEAM_LAUNCHER_CANDIDATES.find((c) => fsMod.existsSync(c)) || "";
}

export type TeamPayload = {
  command?: string; type?: string; subtype?: string; workspace?: string;
  task?: string; goal?: string; autoMergeMode?: string; mergeTimeoutScale?: number;
  id?: string; parallel?: boolean; maxWorkers?: number; noAutoMerge?: boolean; cwd?: string;
};

export async function runTeamCommand(payload: TeamPayload) {
  const launcherPath = resolveTeamLauncher();
  if (!launcherPath) {
    return { ok: false, code: 1, stdout: "", stderr: "",
      warnings: ["team launcher not found. Set " + TEAM_LAUNCHER_ENV + " or install tri-model-collab skill under ~/.codex/skills/"],
      status: "missing_launcher", artifacts: scanArtifacts(payload.cwd || defaultRoot) };
  }
  const args = [
    payload.command || "run",
    "-Type", payload.type || "writing",
    "-Subtype", payload.subtype || "docs",
    "-Workspace", payload.workspace || defaultRoot,
    "-Task", payload.task || "Untitled task",
    "-Goal", payload.goal || "Complete task",
    "-AutoMergeMode", payload.autoMergeMode || "apply",
    "-MergeTimeoutScale", String(payload.mergeTimeoutScale || 4),
  ];
  if (payload.id) args.push("-Id", payload.id);
  if (payload.parallel) args.push("-Parallel", "-MaxWorkers", String(payload.maxWorkers || 2));
  if (payload.noAutoMerge) args.push("-NoAutoMerge");
  const result = await runCmd(launcherPath, args, payload.cwd || process.cwd());
  return {
    ok: result.code === 0, ...result, command: launcherPath, args,
    warnings: result.warnings || [],
    status: result.code === 0 ? "success" : "command_failed",
    artifacts: scanArtifacts(payload.cwd || defaultRoot),
  };
}
