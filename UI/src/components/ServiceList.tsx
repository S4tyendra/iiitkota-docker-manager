import { useEffect, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Terminal } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { Service } from '@/types';
import { toast } from 'sonner';
import { LogViewer } from './LogViewer';

export function ServiceList() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);

    const [selectedService, setSelectedService] = useState<{ id: string, name: string } | null>(null);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get<Service[]>('/services');
            if (Array.isArray(res.data)) {
                setServices(res.data);
            } else {
                console.error("Unexpected response from /services:", res.data);
                toast.error("Received invalid data from server. Check console.");
                setServices([]);
            }
        } catch (error: any) {
            console.error("Fetch services error:", error);
            const msg = error.response?.data?.error || error.message || 'Failed to fetch services';
            toast.error(`Error: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
        const interval = setInterval(fetchServices, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (state: string) => {
        if (state === 'running') return 'default'; // primary/black
        if (state === 'exited') return 'destructive';
        return 'secondary';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Services</h2>
                <Button variant="outline" size="sm" onClick={fetchServices} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Service Name</TableHead>
                            <TableHead>Image</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No services found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            services.map((service) => (
                                <TableRow key={service.id}>
                                    <TableCell className="font-medium">
                                        {service.names[0].replace('/', '')}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        {service.image}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusColor(service.state)}>
                                            {service.state}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{service.status}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Logs"
                                                onClick={() => setSelectedService({ id: service.id, name: service.names[0] })}
                                            >
                                                <Terminal className="h-4 w-4" />
                                            </Button>
                                            {/* TODO: Add Stop/Start/Restart actions if API supports them directly or via update */}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            {selectedService && (
                <LogViewer
                    serviceId={selectedService.id}
                    serviceName={selectedService.name}
                    onClose={() => setSelectedService(null)}
                />
            )}
        </div>
    );
}
