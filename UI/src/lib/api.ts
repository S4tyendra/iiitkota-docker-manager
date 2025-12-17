import axios from 'axios';

const STORAGE_KEY_HOST = 'docker_mgr_host';
const STORAGE_KEY_AUTH = 'docker_mgr_auth';

const ensureProtocol = (url: string) => {
    if (!url) return 'http://localhost:8080';
    if (!/^https?:\/\//i.test(url)) {
        return `https://${url}`; // Default to https if missing
    }
    return url.replace(/\/$/, ''); // Remove trailing slash
};

export const getApiConfig = () => {
    const rawHost = localStorage.getItem(STORAGE_KEY_HOST) || 'http://localhost:8080';
    const host = ensureProtocol(rawHost);
    const auth = localStorage.getItem(STORAGE_KEY_AUTH);
    return { host, auth };
};

export const setApiConfig = (host: string, auth?: string) => {
    localStorage.setItem(STORAGE_KEY_HOST, host);
    if (auth) localStorage.setItem(STORAGE_KEY_AUTH, auth);
};

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

export const updateClientConfig = (username?: string, password?: string) => {
    if (username && password) {
        const auth = btoa(`${username}:${password}`);
        setApiConfig(getApiConfig().host, auth);
    }
}
