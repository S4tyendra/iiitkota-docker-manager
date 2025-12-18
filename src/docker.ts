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

  async deleteService(serviceName: string) {
    const dir = this.ensureEnvDir(serviceName);
    // 1. Docker Compose Down
    const proc = Bun.spawn(['docker', 'compose', 'down', '-v'], { cwd: dir, stderr: 'pipe' });
    await proc.exited; // Ignore errors if it's already down/gone

    // 2. Remove Config Directory
    await Bun.spawn(['rm', '-rf', dir]).exited;
  }

  async getLatestImageDigest(imageName: string): Promise<string | null> {
    if (!imageName.startsWith('ghcr.io/')) return null;

    try {
      // Handle image name with digest or tag
      let cleanName = imageName;
      if (cleanName.includes('@')) cleanName = cleanName.split('@')[0];

      const parts = cleanName.split('/');
      // parts[0] is ghcr.io
      const repoAndTag = parts.slice(1).join('/');
      let [repo, tag] = repoAndTag.split(':');
      if (!tag) tag = 'latest';

      const url = `https://ghcr.io/v2/${repo}/manifests/${tag}`;

      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${CONFIG.GITHUB_PAT}`,
          'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json'
        }
      });

      if (response.ok) {
        return response.headers.get('Docker-Content-Digest');
      }
      return null;
    } catch (e) {
      console.error('Error fetching remote digest:', e);
      return null;
    }
  }
}