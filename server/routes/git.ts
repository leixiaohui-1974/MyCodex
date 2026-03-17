import type { FastifyInstance } from 'fastify';
import { initGitTeamFlow, bindGiteaRemote, runGitTeamQuickFlow, runGitBackup } from '../services/git-ops.js';
import { authGuard } from '../auth/guard.js';

export default async function gitRoutes(fastify: FastifyInstance) {
  fastify.post('/git/team/init', { preHandler: [authGuard] }, async (request) => {
    return initGitTeamFlow(request.body as Parameters<typeof initGitTeamFlow>[0]);
  });
  fastify.post('/git/remote/bind', { preHandler: [authGuard] }, async (request) => {
    return bindGiteaRemote(request.body as Parameters<typeof bindGiteaRemote>[0]);
  });
  fastify.post('/git/team/quick-flow', { preHandler: [authGuard] }, async (request) => {
    return runGitTeamQuickFlow(request.body as Parameters<typeof runGitTeamQuickFlow>[0]);
  });
  fastify.post('/backup/github', { preHandler: [authGuard] }, async (request) => {
    return runGitBackup(request.body as Parameters<typeof runGitBackup>[0]);
  });
}
