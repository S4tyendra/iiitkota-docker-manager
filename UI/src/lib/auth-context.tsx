import React, { createContext, useContext, useState, useEffect } from 'react';
import { setApiConfig, checkAuth, getApiConfig, apiClient } from './api';
import type { User } from '@/types';

interface AuthContextType {
    isAuthenticated: boolean;
    isAdmin: boolean;
    user: User | null;
    isLoading: boolean;
    login: (serverUrl: string, username?: string, password?: string) => Promise<void>;
    logout: () => void;
    checkPermission: (scope: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    const initializeAuth = async () => {
        setIsLoading(true);
        const { auth } = getApiConfig();
        if (auth) {
            try {
                const isValid = await checkAuth();
                if (isValid) {
                    setIsAuthenticated(true);
                    // Infer admin status or fetch user details if possible
                    // Ideally we fetch /api/users to see if we are admin, or /api/me if it existed.
                    // For now, let's try to fetch users. If 200, we are admin.
                    try {
                        await apiClient.get('/api/users');
                        setIsAdmin(true);
                    } catch {
                        setIsAdmin(false);
                    }
                } else {
                    // Auth failed (e.g. changed password or token expired?)
                    logout();
                }
            } catch (e) {
                console.error("Auth check failed", e);
                // If network error, maybe keep state but show error? 
                // For safety, if 401, logout.
                logout();
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        initializeAuth();
    }, []);

    const login = async (serverUrl: string, username?: string, password?: string) => {
        setIsLoading(true);
        let authString = undefined;
        if (username && password) {
            authString = btoa(`${username}:${password}`);
        }

        // Temporarily set config to test
        setApiConfig(serverUrl, authString);

        try {
            const isValid = await checkAuth();
            if (isValid) {
                setIsAuthenticated(true);
                // fetch admin status
                try {
                    await apiClient.get('/api/users');
                    setIsAdmin(true);
                } catch {
                    setIsAdmin(false);
                }

                // Construct a mock user object for now since we don't have /me
                // We assume if we are authenticated, we have at least some permissions.
                setUser({
                    username: username || 'Unknown',
                    permissions: [], // Permissions are fetched per service or assumed global for now
                    isAdmin: false // Updated above
                });

            } else {
                throw new Error("Invalid credentials or server unreachable");
            }
        } catch (error) {
            // Revert config if failed? Or just leave it?
            // Better to leave it so user can correct it, but clear auth if basic auth failed
            if (username || password) {
                // Keep server url, clear auth
                setApiConfig(serverUrl, undefined);
            }
            setIsAuthenticated(false);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        const { host } = getApiConfig();
        setApiConfig(host, undefined); // Keep host, clear auth
        setIsAuthenticated(false);
        setIsAdmin(false);
        setUser(null);
    };

    const checkPermission = (_: string, __: string) => {
        // _scope, __action
        if (isAdmin) return true;
        // logic for checking permissions if we had them stored globally
        // For service scope, it's usually checked against the service object directly.
        // For global scope, we might need to store them.

        // Fallback: If we don't have the permission list, assume false for critical actions 
        // unless we know better.
        return false;
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isAdmin, user, isLoading, login, logout, checkPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
