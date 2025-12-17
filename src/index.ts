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
    config.image = image; // Save image in config for future restarts
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

// 3. GET .ENV
app.get('/services/:name/env', async (c) => {
    const name = c.req.param('name');
    const content = dockerMgr.readEnv(name);
    return c.text(content);
});

// 4. SAVE .ENV & RESTART
app.post('/services/:name/env', async (c) => {
    const name = c.req.param('name');
    try {
        const body = await c.req.json();
        if (typeof body.content !== 'string') return c.json({ error: 'Content string required' }, 400);

        // 1. Save new env
        dockerMgr.saveEnv(name, body.content);

        // 2. Restart Service
        const savedConfig = dockerMgr.readConfig(name);
        
        // Try to recover image from saved config or running container
        let image = savedConfig?.image;
        if (!image) {
             const containers = await dockerMgr.instance.listContainers({ all: true, filters: { name: [name] } });
             const container = containers.find(c => c.Names.some(n => n.endsWith('/' + name)));
             if (container) image = container.Image;
        }

        if (image && savedConfig) {
             // Ensure image is in config now
             savedConfig.image = image;
             const composeContent = dockerMgr.generateComposeContent(name, image, savedConfig);
             await dockerMgr.startService(name, composeContent, true); // recreate=true
             return c.json({ success: true, message: 'Environment variables saved and service restarted' });
        }
        
        return c.json({ success: true, message: 'Environment variables saved. Restart skipped (missing config/image).' });

    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 5. List Services (Merged with Config)
app.get('/services', async (c) => {
  try {
    const containers = await dockerMgr.instance.listContainers({ all: true });
    
    // Enrich with saved config
    const enriched = containers.map(ct => {
        const name = ct.Names[0].replace(/^\//, '');
        const savedConfig = dockerMgr.readConfig(name);
        return {
            id: ct.Id.substring(0, 12),
            names: ct.Names,
            name: name,
            image: ct.Image,
            state: ct.State,
            status: ct.Status,
            config: savedConfig || {}
        };
    });

    return c.json(enriched);
  } catch (err: any) {
    return c.json({ error: `Docker Error: ${err.message}` }, 500);
  }
});

console.log(`running on port ${CONFIG.PORT}`);

export default {
  port: CONFIG.PORT,
  fetch: app.fetch,
};