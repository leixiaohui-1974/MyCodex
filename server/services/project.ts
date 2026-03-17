import path from 'path';
import fs from 'fs';
import {
  ensureDir, slugify, readManifest, writeManifest,
  createDefaultManifest, sanitizeManifest, Manifest
}  from '../lib/shared.js';

function normalizeProject(projectPath: string) {
  return { name: path.basename(projectPath), path: projectPath, manifest: readManifest(projectPath) };
}

export function listProjects(root: string) {
  ensureDir(root);
  const projects = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => normalizeProject(path.join(root, e.name)))
    .sort((a, b) => a.manifest.displayName.localeCompare(b.manifest.displayName));
  return { ok: true as const, projects, root };
}

export function createProject(root: string, name: string) {
  ensureDir(root);
  const displayName = String(name || "").trim();
  const slug = slugify(displayName);
  const projectPath = path.join(root, slug);
  if (fs.existsSync(projectPath)) {
    return { ok: false as const, error: "Project already exists: " + projectPath };
  }
  ensureDir(projectPath);
  ensureDir(path.join(projectPath, "docs"));
  ensureDir(path.join(projectPath, "outputs"));
  writeManifest(projectPath, createDefaultManifest(displayName || slug, slug));
  return { ok: true as const, project: normalizeProject(projectPath) };
}

export function updateManifest(projectPath: string, manifest: Record<string, unknown>) {
  if (!projectPath || !fs.existsSync(projectPath)) {
    return { ok: false as const, error: "Project path does not exist." };
  }
  const defaults = createDefaultManifest(
    String(manifest.displayName || path.basename(projectPath)),
    String(manifest.slug || slugify(path.basename(projectPath))),
  );
  const sanitized = sanitizeManifest(manifest as Partial<Manifest>, defaults);
  writeManifest(projectPath, sanitized);
  return { ok: true as const, project: normalizeProject(projectPath) };
}

export function getProject(projectPath: string) {
  return { ok: true as const, project: normalizeProject(projectPath) };
}
