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

  // Generate Docker Compose file content
  generateComposeContent(serviceName: string, imageName: string, config: DockerServiceConfig): string {
    const envPath = this.getEnvFilePath(serviceName);
    const portMapping = `${config.hostPort}:${config.containerPort}`;
    
    // Ensure .env exists
    if (!existsSync(envPath)) writeFileSync(envPath, '', { flag: 'wx' });

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
}