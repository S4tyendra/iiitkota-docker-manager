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


    const handlePull = async () => {
        setPulling(true);
        setPullLogs([]);
        const { host, auth } = getApiConfig();

        try {
            const response = await fetch(`${host}/images/pull?image=${image}`, {
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
                        setPullLogs(prev => [...prev, `${json.status} ${json.id || ''}`]);
                    } catch {
                        setPullLogs(prev => [...prev, line]);
                    }
                });
            }
            toast.success("Image pulled successfully");
        } catch (err: any) {
            toast.error(`Pull failed: ${err.message}`);
            setPullLogs(prev => [...prev, `Error: ${err.message}`]);
        } finally {
            setPulling(false);
        }
    };

    const handleUpdate = async (recreate: boolean) => {
        if (!canManage && !canEditConfig) return;
        setSubmitting(true);
        try {
            // Determine image to use
            let targetImage = image;
            if (recreate && service.latestImageTags && service.latestImageTags.length > 0 && service.latestImageDigest !== service.currentImageDigest) {
                
                const [repo] = image.split(':');
                targetImage = `${repo}:${service.latestImageTags[0]}`;
            }

            const payload: ServicePayload = {
                service: serviceName,
                image: targetImage,
                recreate: recreate,
                config: {
                    hostPort: formData.hostPort || '8080',
                    containerPort: formData.containerPort || '80',
                    domain: formData.domain || undefined,
                    memoryLimit: formData.memoryLimit,
                    cpuLimit: formData.cpuLimit
                }
            };
            await apiClient.post('/services/start', payload);
            toast.success(`Service ${serviceName} updated/recreated`);
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Update failed');
        } finally {
            setSubmitting(false);
        }
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
                                                <div className="mb-6 p-4 bg-green-900/20 border border-green-900/50 rounded-md flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-bold text-green-500">Update Available {newVersionTag && <span className="text-xs bg-green-900/40 px-2 py-0.5 rounded ml-2">{newVersionTag}</span>}</h4>
                                                        <p className="text-sm text-muted-foreground">A new version of this image is available.</p>
                                                    </div>
                                                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdate(true)} disabled={submitting}>
                                                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                        Update to {newVersionTag || 'Latest'}
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <Button variant="outline" onClick={() => handleUpdate(true)} disabled={submitting}>
                                                    <RefreshCw className="mr-2 h-4 w-4" /> Recreate
                                                </Button>

                                                <Button variant="outline" onClick={handleRestart} disabled={restarting}>
                                                    {restarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                                    Restart
                                                </Button>

                                                <Button variant="destructive" onClick={handleStop} disabled={stopping}>
                                                    {stopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                                                    Stop
                                                </Button>

                                                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
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
                                    <Button className="mt-4" onClick={() => handleUpdate(true)} disabled={submitting}>
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
