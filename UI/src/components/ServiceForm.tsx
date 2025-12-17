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
import { Plus, Loader2 } from "lucide-react";
import { apiClient } from '@/lib/api';
import type { ServicePayload } from '@/types';
import { toast } from 'sonner';

export function ServiceForm() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        serviceName: '',
        image: '',
        hostPort: '',
        containerPort: '',
        domain: '',
        memoryLimit: '512M',
        cpuLimit: '0.5'
    });
    const [recreate, setRecreate] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload: ServicePayload = {
            service: formData.serviceName,
            image: formData.image,
            recreate,
            config: {
                hostPort: formData.hostPort,
                containerPort: formData.containerPort,
                domain: formData.domain || undefined,
                memoryLimit: formData.memoryLimit,
                cpuLimit: formData.cpuLimit
            }
        };

        try {
            await apiClient.post('/services/start', payload);
            toast.success(`Service ${formData.serviceName} started successfully`);
            setOpen(false);
            // Optional: trigger refresh
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
                            <Input id="name" value={formData.serviceName} onChange={e => setFormData({ ...formData, serviceName: e.target.value })} className="col-span-3" placeholder="my-service" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="image" className="text-right">Image</Label>
                            <Input id="image" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} className="col-span-3" placeholder="nginx:latest" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="hostPort" className="text-right">Host Port</Label>
                            <Input id="hostPort" value={formData.hostPort} onChange={e => setFormData({ ...formData, hostPort: e.target.value })} className="col-span-3" placeholder="8080" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="containerPort" className="text-right">Cont. Port</Label>
                            <Input id="containerPort" value={formData.containerPort} onChange={e => setFormData({ ...formData, containerPort: e.target.value })} className="col-span-3" placeholder="80" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="domain" className="text-right">Subdomain</Label>
                            <Input id="domain" value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value })} className="col-span-3" placeholder="app" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="mem" className="text-right">Memory</Label>
                            <Input id="mem" value={formData.memoryLimit} onChange={e => setFormData({ ...formData, memoryLimit: e.target.value })} className="col-span-3" placeholder="512M" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="recreate" className="text-right">Recreate</Label>
                            <Switch id="recreate" checked={recreate} onCheckedChange={setRecreate} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Deploy Service'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
