import type { FastifyPluginAsync } from 'fastify';
import * as skillRegistry from '../services/skill-registry.js';
import { authGuard, roleGuard } from '../auth/guard.js';

type CreateSkillBody = {
  name: string;
  version: string;
  description: string;
  entry_point: string;
  author_id: string;
  config?: Record<string, unknown>;
};

const skillsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/skills
  fastify.get('/api/skills', async (_request, reply) => {
    return reply.send(skillRegistry.list());
  });

  // POST /api/skills - requires admin role
  fastify.post<{ Body: CreateSkillBody }>(
    '/api/skills',
    { preHandler: [authGuard, roleGuard('admin')] },
    async (request, reply) => {
      const { name, version, description, entry_point, author_id, config } = request.body;
      if (!name || !version || !description || !entry_point || !author_id) {
        return reply.code(400).send({ error: 'Missing required fields: name, version, description, entry_point, author_id' });
      }
      const id = skillRegistry.register({ name, version, description, entry_point, author_id, config });
      const skill = skillRegistry.get(id);
      return reply.code(201).send(skill);
    }
  );

  // GET /api/skills/:id
  fastify.get<{ Params: { id: string } }>(
    '/api/skills/:id',
    async (request, reply) => {
      const skill = skillRegistry.get(request.params.id);
      if (!skill) return reply.code(404).send({ error: 'Skill not found' });
      return reply.send(skill);
    }
  );

  // PUT /api/skills/:id
  fastify.put<{ Params: { id: string }; Body: Partial<CreateSkillBody> }>(
    '/api/skills/:id',
    { preHandler: [authGuard, roleGuard('admin')] },
    async (request, reply) => {
      const { id } = request.params;
      const existing = skillRegistry.get(id);
      if (!existing) return reply.code(404).send({ error: 'Skill not found' });

      skillRegistry.unregister(id);
      const newId = skillRegistry.register({
        name: request.body.name ?? existing.name,
        version: request.body.version ?? existing.version,
        description: request.body.description ?? existing.description,
        entry_point: request.body.entry_point ?? existing.entry_point,
        author_id: request.body.author_id ?? existing.author_id,
        config: request.body.config ?? existing.config,
      });
      return reply.send(skillRegistry.get(newId));
    }
  );

  // DELETE /api/skills/:id
  fastify.delete<{ Params: { id: string } }>(
    '/api/skills/:id',
    { preHandler: [authGuard, roleGuard('admin')] },
    async (request, reply) => {
      const { id } = request.params;
      if (!skillRegistry.get(id)) return reply.code(404).send({ error: 'Skill not found' });
      skillRegistry.unregister(id);
      return reply.code(204).send();
    }
  );

  // POST /api/skills/:id/invoke
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/skills/:id/invoke',
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { id } = request.params;
      if (!skillRegistry.get(id)) return reply.code(404).send({ error: 'Skill not found' });
      const result = await skillRegistry.invoke(id, request.body ?? {});
      return reply.send(result);
    }
  );
};

export default skillsRoutes;
