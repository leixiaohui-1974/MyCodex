import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { db } from '../db/index.js';
import { isPathWithinRoots } from '../lib/shared.js';

export interface Skill {
  id: string;
  name: string;
  version: string;
  author_id: string;
  description: string;
  entry_point: string;
  config?: unknown;
  created_at: string;
  updated_at: string;
}

export interface InvokeResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

type SkillInput = Omit<Skill, 'id' | 'created_at' | 'updated_at'>;

const SKILLS_ROOT = process.env.MYCODEX_SKILLS_ROOT || path.join(process.cwd(), 'skills');

function getAllowedSkillRoots(): string[] {
  const roots = [SKILLS_ROOT];
  if (process.env.MYCODEX_EXTRA_SKILLS_ROOTS) {
    roots.push(...process.env.MYCODEX_EXTRA_SKILLS_ROOTS.split(path.delimiter).filter(Boolean));
  }
  return roots;
}

function rowToSkill(row: Record<string, unknown>): Skill {
  return {
    id: String(row.id),
    name: String(row.name),
    version: String(row.version),
    author_id: String(row.author_id),
    description: String(row.description),
    entry_point: String(row.entry_point),
    config: row.config ? JSON.parse(String(row.config)) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function register(skill: SkillInput): string {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO skills (id, name, version, author_id, description, entry_point, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    skill.name,
    skill.version,
    skill.author_id,
    skill.description,
    skill.entry_point,
    skill.config !== undefined ? JSON.stringify(skill.config) : null,
    now,
    now
  );

  return id;
}

export function list(): Skill[] {
  const rows = db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all();
  return (rows as Record<string, unknown>[]).map(rowToSkill);
}

export function get(id: string): Skill | undefined {
  const row = db.prepare('SELECT * FROM skills WHERE id = ? LIMIT 1').get(id);
  if (!row) return undefined;
  return rowToSkill(row as Record<string, unknown>);
}

export async function invoke(
  id: string,
  params: Record<string, unknown>
): Promise<InvokeResult> {
  try {
    const skill = get(id);
    if (!skill) return { ok: false, error: `Skill not found: ${id}` };

    const entryPath = path.isAbsolute(skill.entry_point)
      ? skill.entry_point
      : path.resolve(process.cwd(), skill.entry_point);

    // 路径白名单校验，防止路径遍历攻击
    if (!isPathWithinRoots(entryPath, getAllowedSkillRoots())) {
      return { ok: false, error: `Skill entry_point is outside allowed roots: ${skill.entry_point}` };
    }

    const mod = await import(pathToFileURL(entryPath).href);
    const fn = typeof mod.default === 'function' ? mod.default : mod.invoke;

    if (typeof fn !== 'function') {
      return { ok: false, error: `Skill entry module has no callable default/invoke export: ${skill.entry_point}` };
    }

    const output = await fn(params, skill.config);
    return { ok: true, output };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function unregister(id: string): void {
  db.prepare('DELETE FROM skills WHERE id = ?').run(id);
}
