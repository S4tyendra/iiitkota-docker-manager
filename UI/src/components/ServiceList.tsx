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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RefreshCw, MoreHorizontal, Settings, Terminal, Square } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { Service } from '@/types';
import { ServiceSheet } from './ServiceSheet';

export function ServiceList() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);

    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get<Service[]>('/services');
            if (Array.isArray(res.data)) {
                setServices(res.data);
            } else {
                setServices([]);
            }
        } catch (error: any) {
            // console.error("Fetch services error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
        const interval = setInterval(fetchServices, 5000); // 5s polling
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (state: string) => {
        if (state === 'running') return 'default'; // primary/black (shadcn) or green via class
        if (state === 'exited') return 'destructive';
        return 'secondary';
    };

    const handleManage = (service: Service) => {
        setSelectedService(service);
        setSheetOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                <Button variant="outline" size="sm" onClick={fetchServices} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <div className="rounded-md border bg-card text-card-foreground shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Service Name</TableHead>
                            <TableHead>Image</TableHead>
                            <TableHead>State details</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    {loading ? 'Loading services...' : 'No services found.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            services.map((service) => (
                                <TableRow key={service.id}>
                                    <TableCell>
                                        <Badge variant={getStatusColor(service.state)} className={service.state === 'running' ? 'bg-green-600 hover:bg-green-700' : ''}>
                                            {service.state}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {service.names[0].replace('/', '')}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        {service.image.split('/').pop()} {/* Shorten image for display */}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {service.status}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleManage(service)}>
                                                    <Settings className="mr-2 h-4 w-4" /> Manage
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleManage(service)}>
                                                    <Terminal className="mr-2 h-4 w-4" /> View Logs
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem disabled>
                                                    <RefreshCw className="mr-2 h-4 w-4" /> Restart (WIP)
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled>
                                                    <Square className="mr-2 h-4 w-4" /> Stop (WIP)
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Manage Sheet */}
            {selectedService && (
                <ServiceSheet
                    isOpen={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                    serviceId={selectedService.id}
                    serviceName={selectedService.names[0].replace('/', '')}
                    image={selectedService.image}
                />
            )}
        </div>
    );
}
