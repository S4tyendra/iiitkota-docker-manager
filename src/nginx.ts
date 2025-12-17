import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { CONFIG } from './config';

export class NginxManager {
  private getFilePath(domain: string): string {
    return join(CONFIG.PATHS.NGINX_MANAGED_DIR, `${domain}.conf`);
  }

  createConfig(subdomain: string, port: string, clientMaxBodySize: string = '10M'): boolean {
    const fullDomain = `${subdomain}.${CONFIG.DOMAIN.BASE}`;
    const filePath = this.getFilePath(fullDomain);
    
    const content = `
# Managed by DockerManager
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${fullDomain};

    include ${CONFIG.PATHS.NGINX_SNIPPET};
    client_max_body_size ${clientMaxBodySize};

    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://localhost:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;

    try {
      writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`Failed to write Nginx config for ${fullDomain}:`, error);
      throw error;
    }
  }

  removeConfig(subdomain: string) {
    const fullDomain = `${subdomain}.${CONFIG.DOMAIN.BASE}`;
    const filePath = this.getFilePath(fullDomain);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch (error) {
        console.error(`Failed to remove Nginx config for ${fullDomain}:`, error);
      }
    }
  }

  async reload(): Promise<{ success: boolean; output: string }> {
    // 1. Test Config
    const testProc = Bun.spawn(['sudo', 'nginx', '-t'], { stderr: 'pipe', stdout: 'pipe' });
    const testExit = await testProc.exited;
    
    if (testExit !== 0) {
      const error = await new Response(testProc.stderr).text();
      return { success: false, output: `Config Test Failed:\n${error}` };
    }

    // 2. Reload
    const reloadProc = Bun.spawn(['sudo', 'systemctl', 'reload', 'nginx'], { stderr: 'pipe' });
    const reloadExit = await reloadProc.exited;
    
    if (reloadExit !== 0) {
      const error = await new Response(reloadProc.stderr).text();
      return { success: false, output: `Reload Failed:\n${error}` };
    }

    return { success: true, output: 'Nginx reloaded successfully' };
  }
}