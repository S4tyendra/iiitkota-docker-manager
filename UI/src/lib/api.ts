import axios from 'axios';

const STORAGE_KEY_HOST = 'docker_mgr_host';
const STORAGE_KEY_AUTH = 'docker_mgr_auth';

const ensureProtocol = (url: string) => {
    if (!url) return 'http://localhost:8080';
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `http://${formattedUrl}`; // Default to http, let user specify https if needed, or browser upgrade.
    }
    return formattedUrl.replace(/\/$/, ''); // Remove trailing slash
};

export const getApiConfig = () => {
    const rawHost = localStorage.getItem(STORAGE_KEY_HOST) || 'http://localhost:8080';
    const host = ensureProtocol(rawHost);
    const auth = localStorage.getItem(STORAGE_KEY_AUTH);
    return { host, auth };
};

export const setApiConfig = (host: string, auth?: string) => {
    localStorage.setItem(STORAGE_KEY_HOST, host);
    if (auth) {
        localStorage.setItem(STORAGE_KEY_AUTH, auth);
    } else {
        localStorage.removeItem(STORAGE_KEY_AUTH);
    }
    // Update axios instance defaults immediately
    apiClient.defaults.baseURL = ensureProtocol(host);
};

export const getStoredServerUrl = () => {
    return localStorage.getItem(STORAGE_KEY_HOST) || '';
}

export const apiClient = axios.create({
    baseURL: getApiConfig().host,
});

apiClient.interceptors.request.use((config) => {
    const { host, auth } = getApiConfig();
    config.baseURL = host;
    if (auth) {
        config.headers.Authorization = `Basic ${auth}`;
    }
    return config;
});

// Helper to validate auth/connectivity
export const checkAuth = async (): Promise<boolean> => {
    try {
        // Try a lightweight endpoint. /services is good as it lists things.
        // If 401, returns false.
        await apiClient.get('/services');
        return true;
    } catch (error: any) {
        if (error.response && error.response.status === 401) {
            return false;
        }
        // If it's another error (e.g. network), we might still be "authenticated" but server is down, 
        // but for login purpose, let's treat as failure or let caller handle specific error if needed.
        // For simple boolean check, return false if we can't talk to valid protected endpoint.
        // HOWEVER, if the user has NO permission to list services, this might fail with 403.
        // Let's try /api/users which is admin only? No.
        // Let's try to infer from error.
        if (error.response && error.response.status === 403) {
            // 403 means Authenticated but Forbidden. So we ARE authenticated.
            return true;
        }
        throw error;
    }
}

export const getServiceEnv = async (serviceName: string): Promise<string> => {
    const { data } = await apiClient.get<string>(`/services/${serviceName}/env`);
    return data;
};

export const saveServiceEnv = async (serviceName: string, content: string) => {
    const { data } = await apiClient.post(`/services/${serviceName}/env`, { content });
    return data;
};
