import { join } from 'path';
import { homedir } from 'os';

export const CONFIG = {
  PORT: parseInt(process.env.PORT || Bun.env.PORT || '8080'),

  // ADMIN LOGIN CREDS
  AUTH: {
    USERNAME: process.env.AUTH_USERNAME || Bun.env.AUTH_USERNAME || 'admin',
    PASSWORD: process.env.AUTH_PASSWORD || Bun.env.AUTH_PASSWORD || 'docker123',
  },

  // GITHUB PAT: use .env file to set this
  GITHUB_PAT: process.env.GITHUB_PAT || Bun.env.GITHUB_PAT,

  // Config paths (read docs: https://github.com/s4tyendra/Orchestr8 )
  PATHS: {
    ENV_BASE_DIR: join(homedir(), '.dckr', 'env'), // Where env files and configs are stored
    NGINX_MANAGED_DIR: '/etc/nginx/sites-available/api-managed', // Dir with proper permissions for nginx configs
    NGINX_SNIPPET: 'snippets/ssl-cname-iiitkota.conf', // Nginx snippet for SSL (read docs)
    BACKUP_DIR: './backups', 
  },

  DOMAIN: {
    BASE: 'iiitkota.ac.in', // Base domain of your services
  }, 

  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || Bun.env.ALLOWED_ORIGINS)
  ?.split(',')
  .map(s => s.trim())
  ?? ['http://localhost:5173', 'https://server.iiitkota.ac.in'], // For cors

  // For authuntication with hub
  DOCKER_USERNAME: process.env.DOCKER_USERNAME || Bun.env.DOCKER_USERNAME, 
  DOCKER_PASSWORD: process.env.DOCKER_PASSWORD || Bun.env.DOCKER_PASSWORD || process.env.GITHUB_PAT || Bun.env.GITHUB_PAT,
  DOCKER_SERVER_ADDRESS: process.env.DOCKER_SERVER_ADDRESS || Bun.env.DOCKER_SERVER_ADDRESS || 'ghcr.io',
};

if (!CONFIG.GITHUB_PAT) {
  console.error('❌ GITHUB_PAT environment variable is required');
  process.exit(1);
}