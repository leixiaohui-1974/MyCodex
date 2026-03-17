import type { FastifyInstance } from 'fastify';
import { listArtifacts, readArtifact } from '../services/artifact.js';

export default async function artifactRoutes(fastify: FastifyInstance) {
  fastify.get('/artifacts', async (request, reply) => {
    const { project } = request.query as { project?: string };
    if (!project) return reply.code(400).send({ ok: false, error: 'project query param required' });
    return listArtifacts(project);
  });
  fastify.get('/artifacts/content', async (request, reply) => {
    const { path: filePath, root } = request.query as { path?: string; root?: string };
    if (!filePath) return reply.code(400).send({ ok: false, error: 'path query param required' });
    const result = readArtifact(filePath, root) as { ok: boolean; error?: string };
    if (!result.ok) return reply.code(403).send(result);
    return result;
  });
}
