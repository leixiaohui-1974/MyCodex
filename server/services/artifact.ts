import os from "os";
import path from "path";
import { scanArtifacts, readArtifactContent, isPathWithinRoots } from "../lib/shared.js";

const defaultRoot = process.env.MYCODEX_PROJECTS_ROOT || path.join(os.homedir(), "Documents", "MyCodex", "projects");

export function listArtifacts(projectPath: string): { ok: boolean; artifacts?: unknown[]; error?: string } {
  if (!projectPath) return { ok: false, error: "No project path provided.", artifacts: [] };
  return { ok: true, artifacts: scanArtifacts(projectPath) };
}

export function readArtifact(targetPath: string, projectRoot?: string): unknown {
  const allowedRoots = [projectRoot, defaultRoot].filter(Boolean) as string[];
  if (!isPathWithinRoots(targetPath, allowedRoots)) {
    return { ok: false, error: "Access denied: path is outside project directory." };
  }
  return readArtifactContent(targetPath, projectRoot);
}
