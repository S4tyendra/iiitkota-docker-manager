import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { stream } from 'hono/streaming';
import { cors } from 'hono/cors';
import { CONFIG } from './config';
import { DockerManager } from './docker';
import { NginxManager } from './nginx';
import type { ServicePayload } from './types';

const app = new Hono();
const dockerMgr = new DockerManager();
const nginxMgr = new NginxManager();

// CORS Middleware
app.use('/*', cors({
  origin: CONFIG.ALLOWED_ORIGINS,
  credentials: true,
}));

// Auth Middleware
app.use('/*', basicAuth({ username: CONFIG.AUTH.USERNAME, password: CONFIG.AUTH.PASSWORD }));

// 1. Start/Update Service
app.post('/services/start', async (c) => {
  try {
    const body = await c.req.json() as ServicePayload;
    const { service, image, config, recreate } = body;

    if (!service || !image || !config.hostPort || !config.containerPort) {
      return c.json({ error: 'Missing required fields (service, image, hostPort, containerPort)' }, 400);
    }

    // 1. Docker Compose
    const composeContent = dockerMgr.generateComposeContent(service, image, config);
    await dockerMgr.startService(service, composeContent, !!recreate);

    // 2. Nginx Config (if domain provided)
    let nginxStatus = 'skipped';
    if (config.domain) {
      nginxMgr.createConfig(config.domain, config.hostPort, config.clientMaxBodySize);
      const reloadRes = await nginxMgr.reload();
      nginxStatus = reloadRes.success ? 'updated' : `failed: ${reloadRes.output}`;
    } else {
        // If no domain is passed, try to remove existing config (cleanup)
        // TODO: Add "removeDomain" flag in future
    }

    return c.json({ 
      success: true, 
      message: `Service ${service} started/updated`,
      nginx: nginxStatus
    });

  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Stream Logs
app.get('/services/:id/logs', async (c) => {
  const containerId = c.req.param('id');
  return stream(c, async (stream) => {
    try {
      const container = dockerMgr.instance.getContainer(containerId);
      const logStream = await container.logs({ 
        stdout: true, stderr: true, follow: true, timestamps: true, tail: 50 
      });
      
      // Simple stream piping
      // @ts-ignore
      for await (const chunk of logStream) {
        stream.write(chunk);
      }
    } catch (e: any) {
      stream.write(new TextEncoder().encode(`Error: ${e.message}`));
    }
  });
});

// 3. Stream Pull
app.get('/images/pull', async (c) => {
  const image = c.req.query('image');
  if (!image) return c.text('Missing image param', 400);

  return stream(c, async (stream) => {
    try {
      const dockerStream = await dockerMgr.instance.pull(image, { 
        authconfig: { username: 'iiitkota', password: CONFIG.GITHUB_PAT, serveraddress: 'ghcr.io' } 
      });
      
      await new Promise((resolve, reject) => {
        dockerMgr.instance.modem.followProgress(dockerStream, 
          (err, res) => err ? reject(err) : resolve(res),
          (event) => stream.write(new TextEncoder().encode(JSON.stringify(event) + '\n'))
        );
      });
      stream.write(new TextEncoder().encode('\nDone.'));
    } catch (e: any) {
      stream.write(new TextEncoder().encode(`Error: ${e.message}`));
    }
  });
});

// 4. List Services (Simple JSON)
app.get('/services', async (c) => {
  try {
    const containers = await dockerMgr.instance.listContainers({ all: true });
    // Filter for our managed services if needed, or return all
    return c.json(containers.map(ct => ({
        id: ct.Id.substring(0, 12),
        names: ct.Names,
        image: ct.Image,
        state: ct.State,
        status: ct.Status
    })));
  } catch (err: any) {
    return c.json({ error: `Docker Error: ${err.message}` }, 500);
  }
});

console.log(`running on port ${CONFIG.PORT}`);

export default {
  port: CONFIG.PORT,
  fetch: app.fetch,
};