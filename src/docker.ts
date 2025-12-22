import Docker from 'dockerode';
import { join } from 'path';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { CONFIG } from './config';
import type { DockerServiceConfig } from './types';

export class DockerManager {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  get instance() { return this.docker; }

  ensureEnvDir(serviceName: string): string {
    const dir = join(CONFIG.PATHS.ENV_BASE_DIR, serviceName);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  getEnvFilePath(serviceName: string): string {
    return join(this.ensureEnvDir(serviceName), '.env');
  }

  getConfigFilePath(serviceName: string): string {
    return join(this.ensureEnvDir(serviceName), 'config.json');
  }

  saveConfig(serviceName: string, config: DockerServiceConfig) {
    const path = this.getConfigFilePath(serviceName);
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
  }

  readConfig(serviceName: string): DockerServiceConfig | null {
    const path = this.getConfigFilePath(serviceName);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch (e) {
      return null;
    }
  }

  readEnv(serviceName: string): string {
    const path = this.getEnvFilePath(serviceName);
    if (!existsSync(path)) return '';
    return readFileSync(path, 'utf-8');
  }

  saveEnv(serviceName: string, content: string) {
    const path = this.getEnvFilePath(serviceName);
    writeFileSync(path, content, 'utf-8');
  }

  generateComposeContent(serviceName: string, imageName: string, config: DockerServiceConfig): string {
    const envPath = this.getEnvFilePath(serviceName);
    const portMapping = `${config.hostPort}:${config.containerPort}`;
    
    if (!existsSync(envPath)) writeFileSync(envPath, '', { flag: 'wx' });

    this.saveConfig(serviceName, config);

    return `version: '3.8'
services:
  ${serviceName}:
    image: ${imageName}
    container_name: ${serviceName}
    restart: ${config.restartPolicy || 'unless-stopped'}
    ports:
      - "${portMapping}"
    env_file:
      - ${envPath}
    deploy:
      resources:
        limits:
          cpus: '${config.cpuLimit || '0.5'}'
          memory: ${config.memoryLimit || '512M'}
    labels:
      - "com.docker.compose.service=${serviceName}"
networks:
  default:
    driver: bridge`;
  }

  async startService(serviceName: string, composeContent: string, isRecreate: boolean) {
    const dir = this.ensureEnvDir(serviceName);
    const composePath = join(dir, 'docker-compose.yml');
    
    if (isRecreate) {
       const downProc = Bun.spawn(['docker', 'compose', 'down'], { cwd: dir, stderr: 'pipe' });
       await downProc.exited;
    }

    writeFileSync(composePath, composeContent, 'utf-8');
    
    const proc = Bun.spawn(['docker', 'compose', 'up', '-d'], { cwd: dir, stderr: 'pipe' });
    const exitCode = await proc.exited;
    
    if (exitCode !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`Compose Up Failed: ${err}`);
    }
  }
  async stopService(serviceName: string) {
    const dir = this.ensureEnvDir(serviceName);
    const proc = Bun.spawn(['docker', 'compose', 'stop'], { cwd: dir, stderr: 'pipe' });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`Stop Failed: ${err}`);
    }
  }

  async restartService(serviceName: string) {
    const dir = this.ensureEnvDir(serviceName);
    const proc = Bun.spawn(['docker', 'compose', 'restart'], { cwd: dir, stderr: 'pipe' });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`Restart Failed: ${err}`);
    }
  }

  /**
   * Get the registry manifest digest for a locally pulled image.
   * Docker stores this in RepoDigests after pulling from a registry.
   * Format: "ghcr.io/owner/pkg@sha256:abc123..."
   * Returns just the "sha256:abc123..." part to match GitHub API format.
   */
  async getImageRepoDigest(imageName: string): Promise<string | null> {
    try {
      const image = this.docker.getImage(imageName);
      const info = await image.inspect();
      
      // RepoDigests contains entries like "ghcr.io/iiitkota/api-server@sha256:abc123..."
      // We need just the digest part after @
      if (info.RepoDigests && info.RepoDigests.length > 0) {
        const repoDigest = info.RepoDigests[0];
        const atIndex = repoDigest.lastIndexOf('@');
        if (atIndex !== -1) {
          return repoDigest.substring(atIndex + 1);
        }
      }
      return null;
    } catch (e) {
      // Image might not exist locally or other error
      return null;
    }
  }

  async deleteService(serviceName: string) {
    const dir = this.ensureEnvDir(serviceName);
    // 1. Docker Compose Down
    const proc = Bun.spawn(['docker', 'compose', 'down', '-v'], { cwd: dir, stderr: 'pipe' });
    await proc.exited; // Ignore errors if it's already down/gone

    // 2. Remove Config Directory
    await Bun.spawn(['rm', '-rf', dir]).exited;
  }

  async getLatestImageDigest(imageName: string): Promise<{ digest: string, tags: string[] } | null> {
    if (!imageName.startsWith('ghcr.io/')) return null;

    try {
      // ghcr.io/owner/package:tag
      const parts = imageName.split('/');
      // parts[0] is ghcr.io
      const owner = parts[1];
      let pkg = parts.slice(2).join('/');
      // remove tag from package name if present for API call
      if (pkg.includes(':')) pkg = pkg.split(':')[0];

      if (!CONFIG.GITHUB_PAT) {
         console.warn('GITHUB_PAT missing, cannot fetch private registry details');
         return null;
      }

      const tryFetch = async (type: 'users' | 'orgs') => {
          const url = `https://api.github.com/${type}/${owner}/packages/container/${pkg}/versions`;
          return fetch(url, {
            headers: {
              'Authorization': `Bearer ${CONFIG.GITHUB_PAT}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });
      };

      let response = await tryFetch('users');
      if (response.status === 404) {
          response = await tryFetch('orgs');
      }

      if (response.ok) {
        const versions = await response.json();
        // GitHub returns sorted by created_at desc
        if (Array.isArray(versions) && versions.length > 0) {
            const latest = versions[0];
            return {
                digest: latest.name,
                tags: latest.metadata?.container?.tags || []
            };
        }
      }
      return null;
    } catch (e) {
      console.error('Error fetching remote digest:', e);
      return null;
    }
  }

  async listRegistryImages(): Promise<Array<{ name: string, image: string, updated_at: string }>> {
    if (!CONFIG.GITHUB_PAT) return [];
    
    let owner = CONFIG.DOCKER_USERNAME || 'iiitkota';

    const tryFetch = async (type: 'users' | 'orgs') => {
        const url = `https://api.github.com/${type}/${owner}/packages?package_type=container`;
        return fetch(url, {
            headers: {
                'Authorization': `Bearer ${CONFIG.GITHUB_PAT}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
    };

    try {
        let response = await tryFetch('users');
        if (response.status === 404 || response.status === 403) { 
             response = await tryFetch('orgs');
        }

        if (response.ok) {
            const pkgs = await response.json();
            if (Array.isArray(pkgs)) {
                return pkgs.map((p: any) => ({
                    name: p.name,
                    image: `ghcr.io/${p.owner.login}/${p.name}:latest`,
                    updated_at: p.updated_at
                }));
            }
        }
    } catch (e) {
        console.error("Failed to list registry images:", e);
    }
    return [];
  }
}