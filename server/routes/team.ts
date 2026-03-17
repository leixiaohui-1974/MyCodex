import type { FastifyInstance } from 'fastify';
import { runTeamCommand } from '../services/team-runner.js';
import { authGuard } from '../auth/guard.js';

export default async function teamRoutes(fastify: FastifyInstance) {
  fastify.post('/team/run', { preHandler: [authGuard] }, async (request) => {
    return runTeamCommand(request.body as Parameters<typeof runTeamCommand>[0]);
  });
}
