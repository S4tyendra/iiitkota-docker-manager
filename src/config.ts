import { join } from 'path';
import { homedir } from 'os';

export const CONFIG = {
  PORT: parseInt(process.env.PORT || Bun.env.PORT || '8080'),
  AUTH: {
    USERNAME: process.env.AUTH_USERNAME || Bun.env.AUTH_USERNAME || 'admin',
    PASSWORD: process.env.AUTH_PASSWORD || Bun.env.AUTH_PASSWORD || 'docker123',
  },
  GITHUB_PAT: process.env.GITHUB_PAT || Bun.env.GITHUB_PAT,
  PATHS: {
    ENV_BASE_DIR: join(homedir(), '.dckr', 'env'),
    NGINX_MANAGED_DIR: '/etc/nginx/sites-available/api-managed',
    NGINX_SNIPPET: 'snippets/ssl-cname-iiitkota.conf',
    BACKUP_DIR: './backups',
  },
  DOMAIN: {
    BASE: 'iiitkota.ac.in',
  },
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || Bun.env.ALLOWED_ORIGINS || ['http://localhost:5173', 'https://server.iiitkota.ac.in'],
};

if (!CONFIG.GITHUB_PAT) {
  console.error('❌ GITHUB_PAT environment variable is required');
  process.exit(1);
}