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
import { Loader2, Download, RefreshCw, Save, Trash2, Power, RotateCcw } from 'lucide-react';
import { EnvEditor } from './EnvEditor';
import { EmbeddedLogViewer } from './LogViewer';
import { apiClient, getApiConfig, getServiceEnv, saveServiceEnv } from '@/lib/api';
import type { ServicePayload, Service } from '@/types';
import { toast } from 'sonner';

interface ServiceDrawerProps {
    service: Service;
    isOpen: boolean;
    onClose: () => void;
}

export function ServiceDrawer({ service, isOpen, onClose }: ServiceDrawerProps) {
    const serviceName = service.names[0].replace('/', '');
    const image = service.image;

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
            setActiveTab("manage");

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
    }, [isOpen, service]);


    useEffect(() => {
        if (isOpen && activeTab === 'env') {
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
    }, [isOpen, activeTab, serviceName]);


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
        setSubmitting(true);
        try {
            const payload: ServicePayload = {
                service: serviceName,
                image: image,
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


    return (
        <Drawer open={isOpen} onOpenChange={open => !open && onClose()}>
            <DrawerContent className="h-[90vh]">
                <div className="mx-auto w-full max-w-4xl h-full flex flex-col">
                    <DrawerHeader>
                        <DrawerTitle>Manage {serviceName}</DrawerTitle>
                        <DrawerDescription className="font-mono text-xs truncate">
                            {image}
                            {hasUpdate && <span className="ml-2 text-green-500 font-bold">(Update Available)</span>}
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="px-4 flex-1 overflow-y-auto">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="manage">Manage</TabsTrigger>
                                <TabsTrigger value="config">Configuration</TabsTrigger>
                                <TabsTrigger value="env">Environment</TabsTrigger>
                                <TabsTrigger value="logs">Logs</TabsTrigger>
                            </TabsList>

                            <TabsContent value="manage" className="space-y-6 py-4">

                                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                                    <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Lifecycle Actions</h3>

                                    {hasUpdate && (
                                        <div className="mb-6 p-4 bg-green-900/20 border border-green-900/50 rounded-md flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-green-500">Update Available</h4>
                                                <p className="text-sm text-muted-foreground">A new version of this image is available.</p>
                                            </div>
                                            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdate(true)} disabled={submitting}>
                                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                Update Service
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

                            </TabsContent>

                            {/* CONFIG TAB */}
                            <TabsContent value="config" className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Host Port</Label>
                                        <Input value={formData.hostPort} onChange={e => setFormData({ ...formData, hostPort: e.target.value })} placeholder="8080" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Container Port</Label>
                                        <Input value={formData.containerPort} onChange={e => setFormData({ ...formData, containerPort: e.target.value })} placeholder="80" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Domain</Label>
                                        <Input value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })} placeholder="app" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Memory</Label>
                                        <Input value={formData.memoryLimit} onChange={e => setFormData({ ...formData, memoryLimit: e.target.value })} placeholder="512M" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>CPU</Label>
                                        <Input value={formData.cpuLimit} onChange={e => setFormData({ ...formData, cpuLimit: e.target.value })} placeholder="0.5" />
                                    </div>
                                </div>
                                <Button className="mt-4" onClick={() => handleUpdate(true)} disabled={submitting}>
                                    Save & Recreate
                                </Button>
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
                                        disabled={envSaving}
                                    />
                                )}
                                <Button onClick={handleSaveEnv} disabled={envSaving || envLoading} className="w-full">
                                    {envSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save & Restart
                                </Button>
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
