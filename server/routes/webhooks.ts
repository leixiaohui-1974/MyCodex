import { createHmac, timingSafeEqual } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

export const webhookEmitter = new EventEmitter();

type GiteaEventType = 'push' | 'pull_request' | 'issues' | 'release';

const SUPPORTED_EVENTS = new Set<GiteaEventType>(['push', 'pull_request', 'issues', 'release']);

function verifySignature(body: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const received = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  if (!/^[a-f0-9]{64}$/.test(received)) return false;

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function toBuffer(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  return Buffer.from(JSON.stringify(body ?? ''), 'utf8');
}

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/webhooks/gitea', async (request: FastifyRequest, reply) => {
    const secret = process.env.GITEA_WEBHOOK_SECRET ?? '';
    if (!secret) {
      request.log.error('GITEA_WEBHOOK_SECRET is not configured');
      return reply.code(500).send({ ok: false, error: 'Webhook secret not configured' });
    }

    const sig = Array.isArray(request.headers['x-gitea-signature'])
      ? request.headers['x-gitea-signature'][0]
      : request.headers['x-gitea-signature'];

    const rawBody = toBuffer((request as FastifyRequest & { rawBody?: unknown }).rawBody ?? request.body);

    if (!verifySignature(rawBody, sig, secret)) {
      request.log.warn('Invalid Gitea webhook signature');
      return reply.code(401).send({ ok: false, error: 'Invalid signature' });
    }

    const eventHeader = Array.isArray(request.headers['x-gitea-event'])
      ? request.headers['x-gitea-event'][0]
      : request.headers['x-gitea-event'];

    const event = eventHeader as GiteaEventType | undefined;

    if (!event || !SUPPORTED_EVENTS.has(event)) {
      request.log.info({ event }, 'Ignored unsupported Gitea event');
      return reply.code(400).send({ ok: false, error: 'Unsupported event' });
    }

    request.log.info({ event }, 'Received Gitea webhook');
    webhookEmitter.emit(`gitea.${event}`, request.body);

    return reply.send({ ok: true, event });
  });
};

export default webhooksRoutes;
