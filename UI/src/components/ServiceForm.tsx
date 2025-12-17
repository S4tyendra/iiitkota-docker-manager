import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { apiClient } from '@/lib/api';
import type { ServicePayload } from '@/types';
import { toast } from 'sonner';

export function ServiceForm() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [serviceName, setServiceName] = useState('');
    const [image, setImage] = useState('');
    const [hostPort, setHostPort] = useState('');
    const [containerPort, setContainerPort] = useState('');
    const [domain, setDomain] = useState('');
    const [memoryLimit, setMemoryLimit] = useState('512M');
    const [recreate, setRecreate] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload: ServicePayload = {
            service: serviceName,
            image,
            recreate,
            config: {
                hostPort,
                containerPort,
                domain: domain || undefined,
                memoryLimit,
            }
        };

        try {
            await apiClient.post('/services/start', payload);
            toast.success(`Service ${serviceName} started successfully`);
            setOpen(false);
            // Optional: trigger refresh in list via context or event
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to start service');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> New Service
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Deploy New Service</DialogTitle>
                        <DialogDescription>
                            Configure and deploy a Docker container.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={serviceName} onChange={e => setServiceName(e.target.value)} className="col-span-3" placeholder="my-service" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="image" className="text-right">Image</Label>
                            <Input id="image" value={image} onChange={e => setImage(e.target.value)} className="col-span-3" placeholder="nginx:latest" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="hostPort" className="text-right">Host Port</Label>
                            <Input id="hostPort" value={hostPort} onChange={e => setHostPort(e.target.value)} className="col-span-3" placeholder="8080" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="containerPort" className="text-right">Cont. Port</Label>
                            <Input id="containerPort" value={containerPort} onChange={e => setContainerPort(e.target.value)} className="col-span-3" placeholder="80" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="domain" className="text-right">Subdomain</Label>
                            <Input id="domain" value={domain} onChange={e => setDomain(e.target.value)} className="col-span-3" placeholder="app (optional)" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="memory" className="text-right">Memory</Label>
                            <Input id="memory" value={memoryLimit} onChange={e => setMemoryLimit(e.target.value)} className="col-span-3" placeholder="512M" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="recreate" className="text-right">Recreate</Label>
                            <Switch id="recreate" checked={recreate} onCheckedChange={setRecreate} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Deploying...' : 'Deploy Service'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
