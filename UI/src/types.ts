export interface Permission {
    scope: string;
    action: string;
}

export interface User {
    username: string;
    permissions: Permission[];
    isAdmin?: boolean; // Inferred on frontend if viewing user list succeeds
}

export interface ServicePermissions {
    manage: boolean;
    view_config: boolean;
    edit_config: boolean;
    view_env: boolean;
    edit_env: boolean;
    view_logs: boolean;
}

export interface Service {
    id: string;
    names: string[];
    image: string;
    state: string;
    status: string;
    config?: DockerServiceConfig;
    latestImageDigest?: string;
    currentImageDigest?: string;
    _permissions?: ServicePermissions;
}

export interface DockerServiceConfig {
    cpuLimit?: string;
    memoryLimit?: string;
    hostPort?: string;
    containerPort?: string;
    restartPolicy?: string;
    domain?: string;
    clientMaxBodySize?: string;
    imageTag?: string;
    image?: string;
}

export interface ServicePayload {
    service: string;
    image: string;
    config: DockerServiceConfig;
    recreate?: boolean;
}
