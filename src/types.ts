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

export interface Permission {
  scope: string; // 'global' | 'service:{name}'
  action: 'pull_new_image' | 'add_new_service' | 'view_status' | 'manage' | 'view_configuration' | 'edit_configuration' | 'view_env' | 'edit_env' | 'view_logs' | 'admin'; 
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: boolean; // Backwards compatibility/Super admin
  permissions: Permission[];
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