import crypto from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { getGoogleAuthUrl, handleGoogleCallback } from '../auth/google.js';
import { getWechatQrUrl, handleWechatCallback } from '../auth/wechat.js';
import { getGiteaAuthUrl, handleGiteaCallback } from '../auth/gitea.js';
import { generateToken } from '../auth/jwt.js';
import { authGuard } from '../auth/guard.js';
import {
  db,
  findUserByIdentity,
  createUser,
  createIdentity,
  getUserById,
} from '../db/index.js';

type UserProfile = {
  userId: string;
  name?: string;
  email?: string;
  avatar?: string;
};

async function findOrCreate(
  provider: string,
  profile: UserProfile
): Promise<{ id: string; name: string; email: string; avatar_url: string; role: string }> {
  const existing = findUserByIdentity(provider, profile.userId);

  if (existing) {
    const user = getUserById(existing.user_id);
    if (user) return user as typeof user & { role: string };
  }

  const userId = crypto.randomUUID();

  createUser({
    id: userId,
    name: profile.name ?? 'User',
    email: profile.email,
    avatar_url: profile.avatar,
    role: 'user',
  });

  createIdentity({
    id: crypto.randomUUID(),
    user_id: userId,
    provider,
    external_id: profile.userId,
  });

  return getUserById(userId) as { id: string; name: string; email: string; avatar_url: string; role: string };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 天
};

/** 将 JWT 写入 HttpOnly Cookie 并跳转到前端首页，不在 URL 中暴露 token */
function redirectWithCookie(reply: FastifyReply, token: string, frontendUrl: string) {
  reply.setCookie('mycodex_token', token, COOKIE_OPTIONS);
  return reply.redirect(frontendUrl);
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/auth/google
  fastify.get('/api/auth/google', async (_request, reply) => {
    return reply.redirect(getGoogleAuthUrl());
  });

  // GET /api/auth/google/callback
  fastify.get('/api/auth/google/callback', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.code(400).send({ error: 'Missing code' });

    const profile = await handleGoogleCallback(code);
    const user = await findOrCreate('google', {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
    });

    const token = generateToken({ sub: user.id, provider: 'google', role: user.role });
    const frontendUrl = process.env.FRONTEND_URL ?? '/';
    return redirectWithCookie(reply, token, frontendUrl);
  });

  // GET /api/auth/wechat
  fastify.get('/api/auth/wechat', async (_request, reply) => {
    const result = await getWechatQrUrl();
    return reply.send(result);
  });

  // GET /api/auth/wechat/callback
  fastify.get('/api/auth/wechat/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code) return reply.code(400).send({ error: 'Missing code' });
    if (!state) return reply.code(400).send({ error: 'Missing state' });

    let profile: { userId: string; name: string; avatar: string };
    try {
      profile = await handleWechatCallback(code, state);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 401) {
        return reply.code(401).send({ error: 'Invalid or expired state' });
      }
      throw err;
    }

    const user = await findOrCreate('wechat', {
      userId: profile.userId,
      name: profile.name,
      avatar: profile.avatar,
    });

    const token = generateToken({ sub: user.id, provider: 'wechat', role: user.role });
    const frontendUrl = process.env.FRONTEND_URL ?? '/';
    return redirectWithCookie(reply, token, frontendUrl);
  });

  // GET /api/auth/gitea (redirect to Gitea OAuth)
  fastify.get('/api/auth/gitea', async (_request, reply) => {
    return reply.redirect(getGiteaAuthUrl());
  });

  // GET /api/auth/gitea/callback (Gitea OAuth redirect callback)
  fastify.get('/api/auth/gitea/callback', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.code(400).send({ error: 'Missing code' });

    const profile = await handleGiteaCallback(code);
    const user = await findOrCreate('gitea', {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
    });

    const token = generateToken({ sub: user.id, provider: 'gitea', role: user.role });
    const frontendUrl = process.env.FRONTEND_URL ?? '/';
    return redirectWithCookie(reply, token, frontendUrl);
  });

  // POST /api/auth/gitea/login (前端直接传 code，返回 JSON，向后兼容)
  fastify.post('/api/auth/gitea/login', async (request, reply) => {
    const { code } = request.body as { code?: string };
    if (!code) return reply.code(400).send({ error: 'Missing code' });

    const profile = await handleGiteaCallback(code);
    const user = await findOrCreate('gitea', {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar,
    });

    const token = generateToken({ sub: user.id, provider: 'gitea', role: user.role });
    // 同时设置 Cookie，并在响应体中保留 token 以向后兼容旧客户端
    reply.setCookie('mycodex_token', token, COOKIE_OPTIONS);
    return reply.send({ token, user });
  });

  // GET /api/auth/me
  fastify.get('/api/auth/me', { preHandler: [authGuard] }, async (request, reply) => {
    const user = getUserById(request.user!.sub);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send({ user });
  });

  // POST /api/auth/logout — 清除 Cookie
  fastify.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('mycodex_token', { path: '/' });
    return reply.send({ ok: true });
  });

  void db; // ensure db is initialized
};

export default authRoutes;
