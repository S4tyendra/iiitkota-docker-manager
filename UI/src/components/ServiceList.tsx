import { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Box, Clock, Server, ArrowUpRight, Activity } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { Service } from '@/types';
import { ServiceDrawer } from './ServiceDrawer';

export function ServiceList() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);

    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

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
        const interval = setInterval(fetchServices, 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const getStatusConfig = (state: string) => {
        if (state === 'running') return {
            color: 'bg-emerald-500',
            glow: 'shadow-emerald-500/50',
            badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            pulse: true
        };
        if (state === 'exited') return {
            color: 'bg-red-500',
            glow: 'shadow-red-500/50',
            badge: 'bg-red-500/10 text-red-500 border-red-500/20',
            pulse: false
        };
        if (state === 'available') return {
            color: 'bg-blue-500',
            glow: 'shadow-blue-500/50',
            badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            pulse: false
        };
        return {
            color: 'bg-amber-500',
            glow: 'shadow-amber-500/50',
            badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            pulse: false
        };
    };

    const handleManage = (service: Service) => {
        setSelectedService(service);
        setDrawerOpen(true);
    };

    const runningCount = services.filter(s => s.state === 'running').length;
    const stoppedCount = services.filter(s => s.state !== 'running').length;

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {services.length} service{services.length !== 1 ? 's' : ''} •
                        <span className="text-emerald-500 ml-1">{runningCount} running</span>
                        {stoppedCount > 0 && <span className="text-red-500 ml-1">• {stoppedCount} stopped</span>}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchServices}
                    disabled={loading}
                    className="shrink-0"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Services Grid */}
            {services.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <Box className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">
                            {loading ? 'Loading services...' : 'No services found'}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {loading
                                ? 'Please wait while we fetch your Docker services.'
                                : 'Get started by creating your first Docker service using the button above.'
                            }
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {services.map((service) => {
                        const statusConfig = getStatusConfig(service.state);
                        const serviceName = service.names[0].replace('/', '');
                        const imageName = service.image.split('/').pop() || service.image;

                        return (
                            <Card
                                key={service.id}
                                className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 hover:border-primary/20"
                                onClick={() => handleManage(service)}
                            >
                                {/* Status Indicator Line */}
                                <div className={`absolute top-0 left-0 right-0 h-1 ${statusConfig.color} opacity-80`} />

                                <CardContent className="p-4 pt-5">
                                    {/* Header Row */}
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {/* Status Dot */}
                                            <div className="relative shrink-0">
                                                <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.color} ${statusConfig.glow} shadow-md`} />
                                                {statusConfig.pulse && (
                                                    <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${statusConfig.color} animate-ping opacity-75`} />
                                                )}
                                            </div>
                                            <h3 className="font-semibold truncate text-sm" title={serviceName}>
                                                {serviceName}
                                            </h3>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={`shrink-0 text-xs capitalize ${statusConfig.badge}`}
                                        >
                                            {service.state}
                                        </Badge>
                                    </div>

                                    {/* Info Rows */}
                                    <div className="space-y-2">
                                        {/* Image */}
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Server className="h-3.5 w-3.5 shrink-0 opacity-50" />
                                            <span className="font-mono truncate" title={service.image}>
                                                {imageName}
                                            </span>
                                        </div>

                                        {/* Status */}
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5 shrink-0 opacity-50" />
                                            <span className="truncate" title={service.status}>
                                                {service.status}
                                            </span>
                                        </div>

                                        {/* Domain if available */}
                                        {service.config?.domain && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Activity className="h-3.5 w-3.5 shrink-0 opacity-50" />
                                                <span className="truncate text-primary/80" title={service.config.domain}>
                                                    {service.config.domain}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Hover Action Hint */}
                                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity duration-200">
                                        <span className="text-xs text-muted-foreground">Click to manage</span>
                                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Manage Drawer */}
            {selectedService && (
                <ServiceDrawer
                    isOpen={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    service={selectedService}
                />
            )}
        </div>
    );
}
