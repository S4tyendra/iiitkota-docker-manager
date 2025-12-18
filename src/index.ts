import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { stream } from 'hono/streaming';
import { cors } from 'hono/cors';
import { CONFIG } from './config';
import { DockerManager } from './docker';
import { NginxManager } from './nginx';
import { DB } from './db';
import type { ServicePayload, User } from './types';
import { createMiddleware } from 'hono/factory';

type Variables = {
  user: User;
  body_cache?: ServicePayload;
}

const app = new Hono<{ Variables: Variables }>();
const dockerMgr = new DockerManager();
const nginxMgr = new NginxManager();

app.use('/*', cors({
  origin: CONFIG.ALLOWED_ORIGINS,
  credentials: true,
}));

// Auth Middleware
app.use('/*', async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth) {
    c.header('WWW-Authenticate', 'Basic realm="Access to Docker Manager"');
    return c.text('Unauthorized', 401);
  }

  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return c.text('Byebye', 400);

  const decoded = atob(encoded);
  const [username, password] = decoded.split(':');

  // Env Admin
  if (username === CONFIG.AUTH.USERNAME && password === CONFIG.AUTH.PASSWORD) {
    c.set('user', { username: 'admin', is_admin: true, permissions: [], id: 0, password_hash: '' });
    return next();
  }

  // Database Users
  const user = DB.getUser(username);
  if (user && Bun.password.verifySync(password, user.password_hash)) {
    c.set('user', user);
    return next();
  }

  c.header('WWW-Authenticate', 'Basic realm="Access to Docker Manager"');
  return c.text('Unauthorized', 401);
});

// Permission Helper
const requirePerm = (scope: string, action: string) => createMiddleware(async (c, next) => {
  const user = c.get('user');
  if (!DB.checkPermission(user, scope, action)) {
    return c.json({ error: 'Forbidden: Insufficient Permissions' }, 403);
  }
  await next();
});

const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get('user');
  if (!user.is_admin) {
    return c.json({ error: 'Requires Admin' }, 403);
  }
  await next();
});

// User Management

app.get('/api/users', requireAdmin, (c) => {
  return c.json(DB.allUsers);
});

app.post('/api/users', requireAdmin, async (c) => {
  const { username, password, permissions } = await c.req.json();
  if (!username || !password) return c.json({ error: 'Username and password required' }, 400);
  
  try {
    const hash = Bun.password.hashSync(password);
    const id = DB.createUser(username, hash);
    if (permissions && Array.isArray(permissions)) {
      DB.updatePermissions(Number(id), permissions);
    }
    return c.json({ success: true, id });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

app.delete('/api/users/:username', requireAdmin, (c) => {
  DB.deleteUser(c.req.param('username'));
  return c.json({ success: true });
});

app.patch('/api/users/:username/permissions', requireAdmin, async (c) => {
  const username = c.req.param('username');
  const user = DB.getUser(username);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const { permissions } = await c.req.json();
  DB.updatePermissions(user.id, permissions);
  return c.json({ success: true });
});


app.post('/api/change-password', async (c) => {
  const user = c.get('user');
  const { password } = await c.req.json();
  if (!password) return c.json({ error: 'New password required' }, 400);
  
  if (user.username === CONFIG.AUTH.USERNAME && user.is_admin && !user.id) {
    return c.json({ error: 'Cannot change env-based admin password via UI. Update .env file.' }, 400);
  }

  const hash = Bun.password.hashSync(password);
  DB.updatePassword(user.username, hash);
  return c.json({ success: true });
});


// 1. Start/Update Service (manage)
app.post('/services/start', 
  async (c, next) => {
    const body = await c.req.json();
    c.set('body_cache', body); // Cache body since we consumed it
    // For 'add_new_service', we check if service exists or not? 
    // Simplified: Check if user has 'manage' on this service OR 'add_new_service' globbaly
    // But we need the service name.
    const serviceName = body.service;
    const user = c.get('user');
    
    // Check if service exists (is running or has config)
    const exists = dockerMgr.readConfig(serviceName) !== null;
    
    if (!exists) {
       if (DB.checkPermission(user, 'global', 'add_new_service')) return next();
       return c.json({ error: 'Permission denied: Cannot add new services' }, 403);
    } else {
       if (DB.checkPermission(user, `service:${serviceName}`, 'manage')) return next();
       return c.json({ error: 'Permission denied: Cannot manage this service' }, 403);
    }
  },
  async (c) => {
  try {
    const body = c.get('body_cache') as ServicePayload; // retrieved from cache
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
      // Permission check for nginx already managed by 'manage' or we might want stricter?
      // Staying with 'manage' for now as per user req.
      nginxMgr.createConfig(config.domain, config.hostPort, config.clientMaxBodySize);
      const reloadRes = await nginxMgr.reload();
      nginxStatus = reloadRes.success ? 'updated' : `failed: ${reloadRes.output}`;
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

// 2. Stream Logs (view_logs)
app.get('/services/:id/logs', async (c) => {
  const containerId = c.req.param('id');
  const user = c.get('user');

  // Need to resolve container ID to Service Name to check permissions
  try {
    const container = dockerMgr.instance.getContainer(containerId);
    const info = await container.inspect();
    const name = info.Name.replace('/', '');
    
    if (!DB.checkPermission(user, `service:${name}`, 'view_logs')) {
       return c.text('Forbidden', 403);
    }

    return stream(c, async (stream) => {
      try {
        const logStream = await container.logs({ 
          stdout: true, stderr: true, follow: true, timestamps: true, tail: 50 
        });
        
        // @ts-ignore
        for await (const chunk of logStream) {
          stream.write(chunk);
        }
      } catch (e: any) {
        stream.write(new TextEncoder().encode(`Error: ${e.message}`));
      }
    });
  } catch(e) {
      return c.text('Container not found or error', 404);
  }
});

// 3. Stream Pull (pull_new_image)
app.get('/images/pull', requirePerm('global', 'pull_new_image'), async (c) => {
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

// 4. GET .ENV (view_env)
app.get('/services/:name/env', async (c) => {
    const name = c.req.param('name');
    const user = c.get('user');
    if (!DB.checkPermission(user, `service:${name}`, 'view_env')) {
        return c.text('Forbidden', 403);
    }
    const content = dockerMgr.readEnv(name);
    return c.text(content);
});

// 5. SAVE .ENV & RESTART (edit_env)
app.post('/services/:name/env', async (c) => {
    const name = c.req.param('name');
    const user = c.get('user');
    if (!DB.checkPermission(user, `service:${name}`, 'edit_env')) {
         return c.json({ error: 'Forbidden' }, 403);
    }

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

// 6. STOP SERVICE (manage)
app.post('/services/stop', async (c) => {
    try {
        const { service } = await c.req.json() as { service: string };
        if (!service) return c.json({ error: 'Service name required' }, 400);
        
        const user = c.get('user');
        if (!DB.checkPermission(user, `service:${service}`, 'manage')) return c.json({ error: 'Forbidden' }, 403);

        await dockerMgr.stopService(service);
        return c.json({ success: true, message: `Service ${service} stopped` });
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 7. RESTART SERVICE (manage)
app.post('/services/restart', async (c) => {
    try {
        const { service } = await c.req.json() as { service: string };
        if (!service) return c.json({ error: 'Service name required' }, 400);

        const user = c.get('user');
        if (!DB.checkPermission(user, `service:${service}`, 'manage')) return c.json({ error: 'Forbidden' }, 403);

        await dockerMgr.restartService(service);
        return c.json({ success: true, message: `Service ${service} restarted` });
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 8. DELETE SERVICE (manage)
app.delete('/services/:name', async (c) => {
    const name = c.req.param('name');
    const user = c.get('user');
    // Maybe delete should be restricted to admin or just manage? 
    // User request said: "service:{name}:manage". Deleting a service is management.
    if (!DB.checkPermission(user, `service:${name}`, 'manage')) return c.json({ error: 'Forbidden' }, 403);

    try {
        await dockerMgr.deleteService(name);
        return c.json({ success: true, message: `Service ${name} deleted` });
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 9. List Services (Enrich with permissions)
app.get('/services', async (c) => {
  const user = c.get('user');
  try {
    const containers = await dockerMgr.instance.listContainers({ all: true });
    
    // Enrich with saved config & permissions
    const enriched = await Promise.all(containers.map(async (ct) => {
        const name = ct.Names[0].replace(/^\//, '');
        
        // Filter: Can user see this?
        // "service:{name}:view_status"
        if (!DB.checkPermission(user, `service:${name}`, 'view_status')) return null;

        const savedConfig = dockerMgr.readConfig(name);
        // Only return config if they have view_configuration
        const canViewConfig = DB.checkPermission(user, `service:${name}`, 'view_configuration');
        
        const latestImageDigest = await dockerMgr.getLatestImageDigest(ct.Image);

        return {
            id: ct.Id.substring(0, 12),
            names: ct.Names,
            name: name,
            image: ct.Image,
            state: ct.State,
            status: ct.Status,
            config: canViewConfig ? (savedConfig || {}) : {},
            latestImageDigest,
            currentImageDigest: ct.ImageID,
            // Helper for UI to know what they can do
            _permissions: {
                manage: DB.checkPermission(user, `service:${name}`, 'manage'),
                view_config: canViewConfig,
                edit_config: DB.checkPermission(user, `service:${name}`, 'edit_configuration'),
                view_env: DB.checkPermission(user, `service:${name}`, 'view_env'),
                edit_env: DB.checkPermission(user, `service:${name}`, 'edit_env'),
                view_logs: DB.checkPermission(user, `service:${name}`, 'view_logs'),
            }
        };
    }));

    return c.json(enriched.filter(Boolean));
  } catch (err: any) {
    return c.json({ error: `Docker Error: ${err.message}` }, 500);
  }
});

console.log(`running on port ${CONFIG.PORT}`);

export default {
  port: CONFIG.PORT,
  fetch: app.fetch,
};