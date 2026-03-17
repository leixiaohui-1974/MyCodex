import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken, type JwtPayload } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Dev mode: skip auth when no JWT secret is configured
  if (!process.env.MYCODEX_JWT_SECRET) {
    request.user = { sub: 'dev', provider: 'local', role: 'admin' };
    return;
  }

  try {
    // 优先从 HttpOnly Cookie 读取，向后兼容 Authorization header
    const token =
      request.cookies?.mycodex_token ||
      request.headers.authorization?.replace('Bearer ', '').trim();

    if (!token) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const payload = verifyToken(token);
    request.user = payload;
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function roleGuard(...roles: string[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const role = request.user?.role;
    if (!role || !roles.includes(role)) {
      reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
