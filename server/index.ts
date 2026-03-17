import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';
import { fileURLToPath } from 'url';
import path from 'path';
import projectsRoutes from './routes/projects.js';
import teamRoutes from './routes/team.js';
import gitRoutes from './routes/git.js';
import artifactRoutes from './routes/artifacts.js';
import runtimeRoutes from './routes/runtime.js';
import authRoutes from './routes/auth.js';

const PORT = Number(process.env.MYCODEX_PORT) || 3210;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(websocket);
  try {
    const publicPath = path.join(__dirname, '..', 'dist', 'public');
    const { existsSync } = await import('fs');
    if (existsSync(publicPath)) {
      await app.register(staticPlugin, { root: publicPath, prefix: '/' });
    }
  } catch { /* skip */ }
  await app.register(projectsRoutes, { prefix: '/api/v1' });
  await app.register(teamRoutes, { prefix: '/api/v1' });
  await app.register(gitRoutes, { prefix: '/api/v1' });
  await app.register(artifactRoutes, { prefix: '/api/v1' });
  await app.register(runtimeRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
  try {
    const address = await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info('MyCodex server listening at ' + address);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
