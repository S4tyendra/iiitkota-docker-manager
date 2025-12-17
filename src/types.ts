export interface DockerServiceConfig {
  cpuLimit?: string;
  memoryLimit?: string;
  hostPort?: string;
  containerPort?: string;
  restartPolicy?: string;
  domain?: string;
  clientMaxBodySize?: string;
  imageTag?: string; // Tag specific (e.g. "latest", "v1")
  image?: string;    // Full image name (e.g. "nginx:alpine")
}

export interface ServicePayload {
  service: string;
  image: string;
  config: DockerServiceConfig;
  recreate?: boolean;
}

export interface NginxConfig {
  domain: string;
  port: string;
  clientMaxBodySize: string;
}