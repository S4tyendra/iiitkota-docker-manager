import { useState, useRef, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, RefreshCw, Save } from 'lucide-react';
import { apiClient, getApiConfig, getServiceEnv, saveServiceEnv } from '@/lib/api';
import type { ServicePayload, Service } from '@/types';
import { toast } from 'sonner';

interface ServiceSheetProps {
    service: Service;
    isOpen: boolean;
    onClose: () => void;
}

export function ServiceSheet({ service, isOpen, onClose }: ServiceSheetProps) {
    const serviceName = service.names[0].replace('/', '');
    const image = service.image;

    const [activeTab, setActiveTab] = useState("config");
    // Form State (Config)
    const [formData, setFormData] = useState({
        hostPort: '',
        containerPort: '',
        domain: '',
        memoryLimit: '512M',
        cpuLimit: '0.5'
    });

    // Env State
    const [envContent, setEnvContent] = useState('');
    const [envLoading, setEnvLoading] = useState(false);
    const [envSaving, setEnvSaving] = useState(false);

    // Logs State
    const [logs, setLogs] = useState<string[]>([]);
    const logAbortController = useRef<AbortController | null>(null);

    // Pull State
    const [pulling, setPulling] = useState(false);
    const [pullLogs, setPullLogs] = useState<string[]>([]);

    // Loading State
    const [submitting, setSubmitting] = useState(false);

    // Initialize Config from Service
    useEffect(() => {
        if (isOpen) {
            // Reset states
            setLogs([]);
            setPullLogs([]);
            setPulling(false);
            setEnvContent('');
            setActiveTab("config");

            // Prefill config
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

    // --- Stream Logs ---
    useEffect(() => {
        if (!isOpen || activeTab !== 'logs') return;

        setLogs([`Connecting to logs for ${serviceName}...`]);
        logAbortController.current = new AbortController();

        const fetchLogs = async () => {
            const { host, auth } = getApiConfig();
            const url = `${host}/services/${service.id}/logs`;

            try {
                const response = await fetch(url, {
                    headers: auth ? { 'Authorization': `Basic ${auth}` } : {},
                    signal: logAbortController.current?.signal,
                });

                if (!response.body) throw new Error('No body');
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    setLogs(prev => [...prev, chunk]);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    setLogs(prev => [...prev, `\nError: ${err.message}`]);
                }
            }
        };

        fetchLogs();
        return () => logAbortController.current?.abort();
    }, [isOpen, activeTab, service.id, serviceName]);

    // --- Fetch Env ---
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


    // --- Actions ---
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
                    hostPort: formData.hostPort || '8080', // Default if empty
                    containerPort: formData.containerPort || '80', // Default
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

    return (
        <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
            <SheetContent className="overflow-y-auto p-3">
                <SheetHeader>
                    <SheetTitle>Manage {serviceName}</SheetTitle>
                    <SheetDescription className="font-mono text-xs text-muted-foreground">
                        {image}
                    </SheetDescription>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="config">Configuration</TabsTrigger>
                        <TabsTrigger value="env">Environment</TabsTrigger>
                        <TabsTrigger value="logs">Logs & Monitor</TabsTrigger>
                    </TabsList>

                    {/* CONFIG TAB */}
                    <TabsContent value="config" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Host Port</Label>
                                <Input value={formData.hostPort} onChange={e => setFormData({ ...formData, hostPort: e.target.value })} placeholder="e.g. 8080" />
                            </div>
                            <div className="space-y-2">
                                <Label>Container Port</Label>
                                <Input value={formData.containerPort} onChange={e => setFormData({ ...formData, containerPort: e.target.value })} placeholder="e.g. 80" />
                            </div>
                            <div className="space-y-2">
                                <Label>Domain (Subdomain)</Label>
                                <Input value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })} placeholder="e.g. app" />
                            </div>
                            <div className="space-y-2">
                                <Label>Memory Limit</Label>
                                <Input value={formData.memoryLimit} onChange={e => setFormData({ ...formData, memoryLimit: e.target.value })} placeholder="e.g. 512M" />
                            </div>
                            <div className="space-y-2">
                                <Label>CPU Limit</Label>
                                <Input value={formData.cpuLimit} onChange={e => setFormData({ ...formData, cpuLimit: e.target.value })} placeholder="e.g. 0.5" />
                            </div>
                        </div>

                        <div className="pt-4 border-t flex flex-col gap-4">
                            <div className="rounded p-4 bg-muted/50 space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4" /> Update Strategy
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    To update the service, first pull the latest image, then recreate the container.
                                </p>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={handlePull} disabled={pulling}>
                                        {pulling ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}
                                        Pull Latest Image
                                    </Button>
                                    <Button size="sm" onClick={() => handleUpdate(true)} disabled={submitting || pulling}>
                                        {submitting ? 'Updating...' : 'Save & Recreate'}
                                    </Button>
                                </div>
                                {pullLogs.length > 0 && (
                                    <ScrollArea className="h-32 w-full rounded border bg-black p-2 mt-2">
                                        <div className="text-xs font-mono text-white">
                                            {pullLogs.map((l, i) => <div key={i}>{l}</div>)}
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ENV TAB */}
                    <TabsContent value="env" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Environment Variables (.env)</Label>
                            {envLoading ? (
                                <div className="h-64 flex items-center justify-center border rounded bg-muted/20">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <Textarea
                                    className="font-mono h-64 whitespace-pre"
                                    placeholder="KEY=VALUE"
                                    value={envContent}
                                    onChange={(e) => setEnvContent(e.target.value)}
                                />
                            )}
                            <p className="text-xs text-muted-foreground">
                                * Changes will restart the container.
                            </p>
                        </div>
                        <Button onClick={handleSaveEnv} disabled={envSaving || envLoading}>
                            {envSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save & Restart
                        </Button>
                    </TabsContent>

                    {/* LOGS TAB */}
                    <TabsContent value="logs" className="space-y-4 py-4">
                        <ScrollArea className="h-[60vh] w-full rounded border bg-black p-4">
                            <div className="text-xs font-mono text-white whitespace-pre-wrap">
                                {logs.join('')}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
