import type { FastifyInstance } from 'fastify';
import { getRuntimeStatus } from '../services/shell.js';

export default async function runtimeRoutes(fastify: FastifyInstance) {
  fastify.get('/runtime/status', async () => getRuntimeStatus());
}
