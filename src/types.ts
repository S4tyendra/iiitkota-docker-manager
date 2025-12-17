export interface DockerServiceConfig {
  cpuLimit?: string;
  memoryLimit?: string;
  hostPort?: string;
  containerPort?: string;
  restartPolicy?: string;
  domain?: string;
  clientMaxBodySize?: string;
  imageTag?: string;
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