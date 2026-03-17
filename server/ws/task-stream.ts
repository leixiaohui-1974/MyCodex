import type { FastifyPluginAsync } from 'fastify';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { taskQueue } from '../services/task-queue.js';
import { verifyToken } from '../auth/jwt.js';

interface ClientMessage {
  type?: string;
  taskId?: string;
}

interface OutgoingMessage {
  type: string;
  [key: string]: unknown;
}

interface ClientState {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const taskStreamPlugin: FastifyPluginAsync = async (fastify) => {
  const clients = new Set<ClientState>();

  function safeSend(ws: WebSocket, payload: OutgoingMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function broadcast(type: string, taskId: string, data: unknown): void {
    const payload: OutgoingMessage = { type, taskId, data };
    for (const client of clients) {
      if (client.subscriptions.size === 0 || client.subscriptions.has(taskId)) {
        safeSend(client.ws, payload);
      }
    }
  }

  const onStarted = (id: string, task: unknown) => broadcast('taskStarted', id, task);
  const onDone = (id: string, result: unknown) => broadcast('taskDone', id, result);
  const onFailed = (id: string, error: unknown) => broadcast('taskFailed', id, error);

  taskQueue.on('taskStarted', onStarted);
  taskQueue.on('taskDone', onDone);
  taskQueue.on('taskFailed', onFailed);

  fastify.get('/ws/tasks', { websocket: true }, (connection, request: FastifyRequest) => {
    const ws = connection.socket as WebSocket;

    // 认证：从 URL query 参数中读取并校验 JWT token
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }
    try {
      verifyToken(token);
    } catch {
      ws.close(4003, 'Invalid token');
      return;
    }

    const client: ClientState = { ws, subscriptions: new Set() };
    clients.add(client);

    safeSend(ws, { type: 'connected', message: 'WebSocket connected' });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        if (msg.type === 'subscribe' && msg.taskId) {
          client.subscriptions.add(msg.taskId);
          safeSend(ws, { type: 'subscribed', taskId: msg.taskId });
        }
      } catch {
        safeSend(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    const cleanup = () => clients.delete(client);
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  fastify.addHook('onClose', async () => {
    taskQueue.off('taskStarted', onStarted);
    taskQueue.off('taskDone', onDone);
    taskQueue.off('taskFailed', onFailed);
    for (const client of clients) {
      try { client.ws.close(); } catch { /* ignore */ }
    }
    clients.clear();
  });
};

export default taskStreamPlugin;
