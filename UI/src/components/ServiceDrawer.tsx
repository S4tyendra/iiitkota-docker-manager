import { useState, useEffect } from 'react';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, RefreshCw, Save, Trash2, Power, RotateCcw, Lock } from 'lucide-react';
import { EnvEditor } from './EnvEditor';
import { EmbeddedLogViewer } from './LogViewer';
import { apiClient, getApiConfig, getServiceEnv, saveServiceEnv } from '@/lib/api';
import type { ServicePayload, Service } from '@/types';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

interface ServiceDrawerProps {
    service: Service;
    isOpen: boolean;
    onClose: () => void;
}

export function ServiceDrawer({ service, isOpen, onClose }: ServiceDrawerProps) {
    const { isAdmin } = useAuth();
    const serviceName = service.names[0].replace('/', '');
    const image = service.image;
    // Use permissions from service object, or default to all true if isAdmin, else all false (safe default)
    // If _permissions is missing and NOT admin, assume legacy mode (all true) or restricted? 
    // Given the prompt, _permissions is always returned.
    const perms = service._permissions || {
        manage: isAdmin,
        view_config: isAdmin,
        edit_config: isAdmin,
        view_env: isAdmin,
        edit_env: isAdmin,
        view_logs: isAdmin
    };

    // If _permissions is purely missing (e.g. public mode / old backend), we might want to allow all.
    // However, the backend update ensures it returns.

    // Explicit overrides if isAdmin is true? Backend says "Environment Admin... Bypasses all".
    // So if isAdmin is true, we should ignore _permissions and allow all? 
    // The backend `_permissions` should ideally reflect that for admin too.
    // Let's trust `_permissions` if present, but fallback to `isAdmin` if needed.
    // Actually, let's just use `isAdmin` as an override to be safe.
    const canManage = isAdmin || perms.manage;
    const canViewConfig = isAdmin || perms.view_config || perms.edit_config;
    const canEditConfig = isAdmin || perms.edit_config;
    const canViewEnv = isAdmin || perms.view_env || perms.edit_env;
    const canEditEnv = isAdmin || perms.edit_env;
    const canViewLogs = isAdmin || perms.view_logs;

    const [activeTab, setActiveTab] = useState("manage");
    const [formData, setFormData] = useState({
        hostPort: '',
        containerPort: '',
        domain: '',
        memoryLimit: '512M',
        cpuLimit: '0.5'
    });

    const [envContent, setEnvContent] = useState('');
    const [envLoading, setEnvLoading] = useState(false);
    const [envSaving, setEnvSaving] = useState(false);

    const [pulling, setPulling] = useState(false);
    const [pullLogs, setPullLogs] = useState<string[]>([]);

    const [submitting, setSubmitting] = useState(false);

    const [stopping, setStopping] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [deleting, setDeleting] = useState(false);


    useEffect(() => {
        if (isOpen) {
            setPullLogs([]);
            setPulling(false);
            setEnvContent('');
            // Default to first available tab
            if (canManage) setActiveTab("manage");
            else if (canViewConfig) setActiveTab("config");
            else if (canViewEnv) setActiveTab("env");
            else if (canViewLogs) setActiveTab("logs");
            else setActiveTab("manage"); // Fallback

            if (service.config) {
                setFormData({
                    hostPort: service.config.hostPort || '',
                    containerPort: service.config.containerPort || '',
                    domain: service.config.domain || '',
                    memoryLimit: service.config.memoryLimit || '512M',
                    cpuLimit: service.config.cpuLimit || '0.5'
                });
            }
        }
    }, [isOpen, service, canManage, canViewConfig, canViewEnv, canViewLogs]);


    useEffect(() => {
        if (isOpen && activeTab === 'env' && canViewEnv) {
            const fetchEnv = async () => {
                setEnvLoading(true);
                try {
                    const data = await getServiceEnv(serviceName);
                    setEnvContent(data);
                } catch (error) {
                    toast.error("Failed to load environment variables");
                } finally {
                    setEnvLoading(false);
                }
            };
            fetchEnv();
        }
    }, [isOpen, activeTab, serviceName, canViewEnv]);


    const [updateLogs, setUpdateLogs] = useState<string[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);

    // Helper to pull image and stream logs
    const runPull = async (imageToPull: string, logSetter: (logs: string[] | ((prev: string[]) => string[])) => void) => {
        const { host, auth } = getApiConfig();
        try {
            const response = await fetch(`${host}/images/pull?image=${imageToPull}`, {
                headers: auth ? { 'Authorization': `Basic ${auth}` } : {},
            });

            if (!response.body) throw new Error('No body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(Boolean);
                lines.forEach(line => {
                    try {
                        const json = JSON.parse(line);
                        logSetter(prev => [...prev, `${json.status} ${json.id || ''}`]);
                    } catch {
                        logSetter(prev => [...prev, line]);
                    }
                });
            }
        } catch (err: any) {
            logSetter(prev => [...prev, `Error: ${err.message}`]);
            throw err;
        }
    };

    const handlePull = async () => {
        setPulling(true);
        setPullLogs([]);
        try {
            await runPull(image, setPullLogs);
            toast.success("Image pulled successfully");
        } catch (err: any) {
            toast.error(`Pull failed: ${err.message}`);
        } finally {
            setPulling(false);
        }
    };

    const handleSmartUpdate = async (newTag: string) => {
        const [repo] = image.split(':');
        const targetImage = `${repo}:${newTag}`;

        setIsUpdating(true);
        setUpdateLogs([`Starting update to ${newTag}...`]);

        try {
            // 1. Pull new image
            setUpdateLogs(prev => [...prev, `Pulling ${targetImage}...`]);
            await runPull(targetImage, setUpdateLogs);
            setUpdateLogs(prev => [...prev, 'Pull complete. Recreating service...', '']);

            // 2. Update service
            const payload: ServicePayload = {
                service: serviceName,
                image: targetImage,
                recreate: true,
                config: {
                    hostPort: formData.hostPort || '8080',
                    containerPort: formData.containerPort || '80',
                    domain: formData.domain || undefined,
                    memoryLimit: formData.memoryLimit,
                    cpuLimit: formData.cpuLimit
                }
            };

            await apiClient.post('/services/start', payload);
            setUpdateLogs(prev => [...prev, 'Service updated successfully!']);
            toast.success(`Service updated to ${newTag}`);

            // Close after a brief delay so user sees success
            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (error: any) {
            setUpdateLogs(prev => [...prev, `Update failed: ${error.message}`]);
            toast.error("Update failed");
        } finally {
            // keep logs visible? 
            // setIsUpdating(false); // Don't hide immediately so they can see logs
        }
    };


    const handleRecreate = async () => {
        if (!canManage && !canEditConfig) return;
        setSubmitting(true);
        try {
            // Explicitly use CURRENT image logic, do not auto-swap
            const payload: ServicePayload = {
                service: serviceName,
                image: image, // Keep existing image string
                recreate: true,
                config: {
                    hostPort: formData.hostPort || '8080',
                    containerPort: formData.containerPort || '80',
                    domain: formData.domain || undefined,
                    memoryLimit: formData.memoryLimit,
                    cpuLimit: formData.cpuLimit
                }
            };
            await apiClient.post('/services/start', payload);
            toast.success(`Service ${serviceName} recreated`);
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Recreate failed');
        } finally {
            setSubmitting(false);
        }
    };

    // Generic config update (Save & Recreate)
    const handleConfigUpdate = async () => {
        // This is technically a "Recreate" with new config.
        // It should also Preserve the image tag unless the user manually edited the config?
        // In this UI, image tag isn't editable in the config tab inputs (only ports/limits).
        // So we treat it same as handleRecreate but with new form data.
        await handleRecreate();
    };


    const handleSaveEnv = async () => {
        if (!canEditEnv) return;
        setEnvSaving(true);
        try {
            await saveServiceEnv(serviceName, envContent);
            toast.success("Env saved and service restarting...");
            onClose();
        } catch (error: any) {
            toast.error("Failed to save env: " + error.message);
        } finally {
            setEnvSaving(false);
        }
    };

    const handleStop = async () => {
        setStopping(true);
        try {
            await apiClient.post('/services/stop', { service: serviceName });
            toast.success(`Service ${serviceName} stopped`);
            onClose();
        } catch (error: any) {
            toast.error("Stop failed: " + error.response?.data?.error);
        } finally { setStopping(false); }
    };

    const handleRestart = async () => {
        setRestarting(true);
        try {
            await apiClient.post('/services/restart', { service: serviceName });
            toast.success(`Service ${serviceName} restarted`);
            onClose();
        } catch (error: any) {
            toast.error("Restart failed: " + error.response?.data?.error);
        } finally { setRestarting(false); }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${serviceName}? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/services/${serviceName}`);
            toast.success(`Service ${serviceName} deleted`);
            onClose();
        } catch (error: any) {
            toast.error("Delete failed: " + error.response?.data?.error);
        } finally { setDeleting(false); }
    };

    const hasUpdate = service.latestImageDigest && service.currentImageDigest && service.latestImageDigest !== service.currentImageDigest;
    const newVersionTag = (hasUpdate && service.latestImageTags && service.latestImageTags.length > 0) ? service.latestImageTags[0] : null;

    return (
        <Drawer open={isOpen} onOpenChange={open => !open && onClose()}>
            <DrawerContent className="h-[90vh]">
                <div className="mx-auto w-full max-w-4xl h-full flex flex-col">
                    <DrawerHeader>
                        <DrawerTitle>Manage {serviceName}</DrawerTitle>
                        <DrawerDescription className="font-mono text-xs truncate">
                            {image}
                            {hasUpdate && <span className="ml-2 text-green-500 font-bold">(Update Available{newVersionTag ? `: ${newVersionTag}` : ''})</span>}
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="px-4 flex-1 overflow-y-auto">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="manage" disabled={!canManage}>Manage</TabsTrigger>
                                <TabsTrigger value="config" disabled={!canViewConfig}>Configuration</TabsTrigger>
                                <TabsTrigger value="env" disabled={!canViewEnv}>Environment</TabsTrigger>
                                <TabsTrigger value="logs" disabled={!canViewLogs}>Logs</TabsTrigger>
                            </TabsList>

                            <TabsContent value="manage" className="space-y-6 py-4">
                                {!canManage ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                                        <Lock className="h-8 w-8 mb-2" />
                                        <p>You do not have permission to manage this service.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Lifecycle Actions</h3>

                                            {hasUpdate && (
                                                <div className="mb-6 border border-green-900/50 bg-green-900/10 rounded-md overflow-hidden transition-all duration-300">
                                                    {!isUpdating ? (
                                                        <div className="p-4 flex items-center justify-between">
                                                            <div>
                                                                <h4 className="font-bold text-green-500 flex items-center gap-2">
                                                                    <Download className="h-4 w-4" />
                                                                    Update Available
                                                                    {newVersionTag && <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded text-green-400 font-mono">{newVersionTag}</span>}
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    Current: <span className="font-mono text-red-400">{image.split(':')[1] || 'latest'}</span> → New: <span className="font-mono text-green-400">{newVersionTag}</span>
                                                                </p>
                                                            </div>
                                                            <Button
                                                                className="bg-green-600 hover:bg-green-700 text-white border-0"
                                                                onClick={() => newVersionTag && handleSmartUpdate(newVersionTag)}
                                                                disabled={isUpdating}
                                                            >
                                                                Update Now
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-black/50">
                                                            <div className="flex items-center gap-2 mb-2 text-green-400 text-sm font-medium">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Updating to {newVersionTag}...
                                                            </div>
                                                            <ScrollArea className="h-48 w-full rounded border border-white/10 bg-black/80 p-3">
                                                                <div className="font-mono text-xs text-gray-300 space-y-1">
                                                                    {updateLogs.map((log, i) => (
                                                                        <div key={i} className="break-all">{log}</div>
                                                                    ))}
                                                                    {/* Auto-scroll anchor could be added here */}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <Button variant="outline" onClick={handleRecreate} disabled={submitting || isUpdating}>
                                                    <RefreshCw className="mr-2 h-4 w-4" /> Recreate
                                                </Button>

                                                <Button variant="outline" onClick={handleRestart} disabled={restarting || isUpdating}>
                                                    {restarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                                    Restart
                                                </Button>

                                                <Button variant="destructive" onClick={handleStop} disabled={stopping || isUpdating}>
                                                    {stopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                                                    Stop
                                                </Button>

                                                <Button variant="destructive" onClick={handleDelete} disabled={deleting || isUpdating}>
                                                    {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Image Management</h3>
                                            <div className="flex gap-4 items-center">
                                                <Button variant="secondary" onClick={handlePull} disabled={pulling}>
                                                    {pulling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                    Pull Image Only
                                                </Button>
                                                {pullLogs.length > 0 && <span className="text-xs text-muted-foreground">Pulling...</span>}
                                            </div>
                                            {pullLogs.length > 0 && (
                                                <ScrollArea className="h-32 w-full rounded border bg-black p-2 mt-4">
                                                    <div className="text-xs font-mono text-white">
                                                        {pullLogs.map((l, i) => <div key={i}>{l}</div>)}
                                                    </div>
                                                </ScrollArea>
                                            )}
                                        </div>
                                    </>
                                )}
                            </TabsContent>

                            {/* CONFIG TAB */}
                            <TabsContent value="config" className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Host Port</Label>
                                        <Input value={formData.hostPort} onChange={e => setFormData({ ...formData, hostPort: e.target.value })} placeholder="8080" disabled={!canEditConfig} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Container Port</Label>
                                        <Input value={formData.containerPort} onChange={e => setFormData({ ...formData, containerPort: e.target.value })} placeholder="80" disabled={!canEditConfig} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Domain</Label>
                                        <Input value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })} placeholder="app" disabled={!canEditConfig} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Memory</Label>
                                        <Input value={formData.memoryLimit} onChange={e => setFormData({ ...formData, memoryLimit: e.target.value })} placeholder="512M" disabled={!canEditConfig} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>CPU</Label>
                                        <Input value={formData.cpuLimit} onChange={e => setFormData({ ...formData, cpuLimit: e.target.value })} placeholder="0.5" disabled={!canEditConfig} />
                                    </div>
                                </div>
                                {canEditConfig && (
                                    <Button className="mt-4" onClick={handleConfigUpdate} disabled={submitting}>
                                        Save & Recreate
                                    </Button>
                                )}
                            </TabsContent>

                            {/* ENV TAB */}
                            <TabsContent value="env" className="space-y-4 py-4">
                                {envLoading ? (
                                    <div className="h-64 flex items-center justify-center border rounded bg-muted/20">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <EnvEditor
                                        value={envContent}
                                        onChange={setEnvContent}
                                        disabled={envSaving || !canEditEnv}
                                    />
                                )}
                                {canEditEnv && (
                                    <Button onClick={handleSaveEnv} disabled={envSaving || envLoading} className="w-full">
                                        {envSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save & Restart
                                    </Button>
                                )}
                            </TabsContent>

                            {/* LOGS TAB */}
                            <TabsContent value="logs" className="py-4">
                                {activeTab === 'logs' && (
                                    <EmbeddedLogViewer
                                        serviceId={service.id}
                                        serviceName={serviceName}
                                    />
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
