import type { FastifyInstance } from 'fastify';
import os from 'os';
import path from 'path';
import { listProjects, createProject, updateManifest } from '../services/project.js';
import { authGuard } from '../auth/guard.js';
import { isPathWithinRoots } from '../lib/shared.js';

const DEFAULT_ROOT = process.env.MYCODEX_PROJECTS_ROOT || path.join(os.homedir(), 'Documents', 'MyCodex', 'projects');

function getAllowedRoots(): string[] {
  const roots = [DEFAULT_ROOT];
  if (process.env.MYCODEX_EXTRA_ROOTS) {
    roots.push(...process.env.MYCODEX_EXTRA_ROOTS.split(path.delimiter).filter(Boolean));
  }
  return roots;
}

export default async function projectsRoutes(fastify: FastifyInstance) {
  fastify.get('/projects', { preHandler: [authGuard] }, async (request, reply) => {
    const { root } = request.query as { root?: string };
    const effectiveRoot = root || DEFAULT_ROOT;
    if (root && !isPathWithinRoots(root, getAllowedRoots())) {
      return reply.code(403).send({ ok: false, error: 'Path not allowed' });
    }
    return listProjects(effectiveRoot);
  });

  fastify.post('/projects', { preHandler: [authGuard] }, async (request, reply) => {
    const { root, name } = request.body as { root?: string; name: string };
    if (!name?.trim()) return reply.code(400).send({ ok: false, error: 'name is required' });
    if (root && !isPathWithinRoots(root, getAllowedRoots())) {
      return reply.code(403).send({ ok: false, error: 'Path not allowed' });
    }
    const result = createProject(root || DEFAULT_ROOT, name);
    if (!result.ok) return reply.code(409).send(result);
    return result;
  });

  fastify.put('/projects/:slug/manifest', { preHandler: [authGuard] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const manifest = request.body as Record<string, unknown>;
    const { root } = request.query as { root?: string };
    if (root && !isPathWithinRoots(root, getAllowedRoots())) {
      return reply.code(403).send({ ok: false, error: 'Path not allowed' });
    }
    const projectPath = path.join(root || DEFAULT_ROOT, slug);
    const result = updateManifest(projectPath, manifest);
    if (!result.ok) return reply.code(404).send(result);
    return result;
  });
}
