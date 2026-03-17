import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { db } from '../db/index.js';

export interface Task {
  id: string;
  type: string;
  subtype: string;
  task_text: string;
  goal_text: string;
  project_id?: string;
  user_id?: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
  created_at: string;
  finished_at?: string;
}

const MAX_CONCURRENT = 2;

const pendingQueue: Task[] = [];
const runningTaskIds = new Set<string>();

export const taskQueue = new EventEmitter();

export function enqueue(task: Omit<Task, 'id' | 'status' | 'created_at'>): string {
  const id = randomUUID();
  const created_at = new Date().toISOString();

  const record: Task = {
    id,
    type: task.type,
    subtype: task.subtype,
    task_text: task.task_text,
    goal_text: task.goal_text,
    project_id: task.project_id,
    user_id: task.user_id,
    status: 'pending',
    created_at,
  };

  db.prepare(
    `INSERT INTO tasks (id, type, subtype, task_text, goal_text, project_id, user_id, status, created_at)
     VALUES (@id, @type, @subtype, @task_text, @goal_text, @project_id, @user_id, @status, @created_at)`
  ).run({
    id: record.id,
    type: record.type,
    subtype: record.subtype,
    task_text: record.task_text,
    goal_text: record.goal_text,
    project_id: record.project_id ?? null,
    user_id: record.user_id ?? null,
    status: record.status,
    created_at: record.created_at,
  });

  pendingQueue.push(record);
  processNext();
  return id;
}

export function dequeue(): Task | undefined {
  const idx = pendingQueue.findIndex((t) => t.status === 'pending');
  if (idx === -1) return undefined;
  const [task] = pendingQueue.splice(idx, 1);
  return task;
}

export function getStatus(taskId: string): Task | undefined {
  return db
    .prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1')
    .get(taskId) as Task | undefined;
}

export function processNext(): void {
  while (runningTaskIds.size < MAX_CONCURRENT) {
    const next = dequeue();
    if (!next) break;

    runningTaskIds.add(next.id);
    db.prepare(`UPDATE tasks SET status = 'running' WHERE id = ?`).run(next.id);
    taskQueue.emit('taskStarted', next.id, next);
  }
}

export function completeTask(id: string, result?: string): void {
  const finished_at = new Date().toISOString();
  db.prepare(
    `UPDATE tasks SET status = 'done', result = ?, finished_at = ? WHERE id = ?`
  ).run(result ?? null, finished_at, id);
  runningTaskIds.delete(id);
  taskQueue.emit('taskDone', id, result);
  processNext();
}

export function failTask(id: string, error: string): void {
  const finished_at = new Date().toISOString();
  db.prepare(
    `UPDATE tasks SET status = 'failed', result = ?, finished_at = ? WHERE id = ?`
  ).run(error, finished_at, id);
  runningTaskIds.delete(id);
  taskQueue.emit('taskFailed', id, error);
  processNext();
}
