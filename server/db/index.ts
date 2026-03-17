import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

const DB_PATH = process.env.DB_PATH ?? '/data/db/mycodex.db';

// 确保目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new BetterSqlite3(DB_PATH);

// WAL 模式
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 自动建表
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schemaSql);

export function findUserByIdentity(
  provider: string,
  externalId: string
): { user_id: string } | undefined {
  return db
    .prepare('SELECT user_id FROM user_identities WHERE provider = ? AND external_id = ? LIMIT 1')
    .get(provider, externalId) as { user_id: string } | undefined;
}

export function createUser(user: {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role: string;
}): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, name, email, avatar_url, role, created_at, updated_at)
     VALUES (@id, @name, @email, @avatar_url, @role, @created_at, @updated_at)`
  ).run({
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    avatar_url: user.avatar_url ?? null,
    role: user.role,
    created_at: now,
    updated_at: now,
  });
}

export function createIdentity(identity: {
  id: string;
  user_id: string;
  provider: string;
  external_id: string;
  metadata?: unknown;
}): void {
  db.prepare(
    `INSERT INTO user_identities (id, user_id, provider, external_id, metadata, created_at)
     VALUES (@id, @user_id, @provider, @external_id, @metadata, @created_at)`
  ).run({
    id: identity.id,
    user_id: identity.user_id,
    provider: identity.provider,
    external_id: identity.external_id,
    metadata: identity.metadata != null ? JSON.stringify(identity.metadata) : null,
    created_at: new Date().toISOString(),
  });
}

export function getUserById(id: string): User | undefined {
  return db
    .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
    .get(id) as User | undefined;
}

export function updateUser(
  id: string,
  updates: Partial<{ name: string; email: string; avatar_url: string }>
): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (updates.name !== undefined) { fields.push('name = @name'); params.name = updates.name; }
  if (updates.email !== undefined) { fields.push('email = @email'); params.email = updates.email; }
  if (updates.avatar_url !== undefined) { fields.push('avatar_url = @avatar_url'); params.avatar_url = updates.avatar_url; }

  if (fields.length === 0) return;

  params.updated_at = new Date().toISOString();
  fields.push('updated_at = @updated_at');

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = @id`).run(params);
}
