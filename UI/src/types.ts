export interface Service {
    id: string;
    names: string[];
    image: string;
    state: string;
    status: string;
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
}

export interface ServicePayload {
    service: string;
    image: string;
    config: DockerServiceConfig;
    recreate?: boolean;
}
