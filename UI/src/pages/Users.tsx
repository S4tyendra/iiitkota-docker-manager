import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import type { User, Permission, Service } from '@/types';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
    Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose
} from "@/components/ui/drawer";
import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";

import { Checkbox } from "@/components/ui/checkbox";

import { Label } from '@/components/ui/label';
import { toast } from "sonner";
import { Plus, Trash2, Shield, RefreshCw, ChevronDown, ChevronRight, Globe, Container, Loader2 } from "lucide-react";

export default function Users() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data } = await apiClient.get<User[]>('/api/users');
            setUsers(data);
        } catch (error) {
            toast.error("Failed to load users");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDeleteUser = async (username: string) => {
        if (!confirm(`Are you sure you want to delete user ${username}?`)) return;
        try {
            await apiClient.delete(`/ api / users / ${username} `);
            toast.success("User deleted");
            fetchUsers();
        } catch (error) {
            toast.error("Failed to delete user");
        }
    };

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">User Management</h1>
                    <p className="text-muted-foreground">Manage users and their permissions</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchUsers}>
                        <RefreshCw className={isLoading ? "animate-spin" : ""} />
                    </Button>
                    <CreateUserDialog onCreated={fetchUsers} />
                </div>
            </div>

            <div className="border rounded-lg bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        )}
                        {users.map((user) => (
                            <TableRow key={user.username}>
                                <TableCell className="font-medium">{user.username}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {(user.permissions ?? []).length === 0 ? <span className="text-muted-foreground italic text-sm">No permissions</span> : null}
                                        {(user.permissions ?? []).slice(0, 5).map((p, idx) => (
                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                                                {p.scope === 'global' ? 'Global' : p.scope.replace('service:', 'S:')}: {p.action}
                                            </span>
                                        ))}
                                        {(user.permissions ?? []).length > 5 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                                +{(user.permissions ?? []).length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <EditPermissionsDrawer user={user} onUpdated={fetchUsers} />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => handleDeleteUser(user.username)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await apiClient.post('/api/users', {
                username,
                password,
                permissions: [] // Start with no permissions, user needs to add them
            });
            toast.success("User created successfully");
            setOpen(false);
            setUsername("");
            setPassword("");
            onCreated();
        } catch (error) {
            toast.error("Failed to create user");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add User
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                        Add a new user to the database. You can assign permissions after creation.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-username" className="text-right">
                                Username
                            </Label>
                            <Input
                                id="new-username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-password" className="text-right">
                                Password
                            </Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>create user</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditPermissionsDrawer({ user, onUpdated }: { user: User, onUpdated: () => void }) {
    const [open, setOpen] = useState(false);
    const [perms, setPerms] = useState<Permission[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingServices, setIsLoadingServices] = useState(false);

    // Accordion states
    const [isGlobalOpen, setIsGlobalOpen] = useState(true);
    const [customService, setCustomService] = useState("");

    useEffect(() => {
        if (open) {
            setPerms([...(user.permissions ?? [])]);
            fetchServices();
        }
    }, [open, user]);

    const fetchServices = async () => {
        setIsLoadingServices(true);
        try {
            const { data } = await apiClient.get<Service[]>('/services');
            setServices(data || []);
        } catch (error) {
            console.error("Failed to fetch services", error);
        } finally {
            setIsLoadingServices(false);
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await apiClient.patch(`/api/users/${user.username}/permissions`, {
                permissions: perms
            });
            toast.success("Permissions updated");
            setOpen(false);
            onUpdated();
        } catch (error) {
            toast.error("Failed to update permissions");
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasPermission = (scope: string, action: string) => {
        return perms.some(p => p.scope === scope && p.action === action);
    };

    const togglePermission = (scope: string, action: string, checked: boolean) => {
        let newPerms = [...perms];

        if (checked) {
            // Add the requested permission
            if (!newPerms.some(p => p.scope === scope && p.action === action)) {
                newPerms.push({ scope, action });
            }

            // Rule 1: Any service permission implies view_status
            if (scope.startsWith('service:') && action !== 'view_status') {
                if (!newPerms.some(p => p.scope === scope && p.action === 'view_status')) {
                    newPerms.push({ scope, action: 'view_status' });
                }
            }

            // Rule 2: Edit implies View
            if (action === 'edit_env') {
                if (!newPerms.some(p => p.scope === scope && p.action === 'view_env')) {
                    newPerms.push({ scope, action: 'view_env' });
                }
            }
            if (action === 'edit_configuration') {
                if (!newPerms.some(p => p.scope === scope && p.action === 'view_configuration')) {
                    newPerms.push({ scope, action: 'view_configuration' });
                }
            }

        } else {
            // Remove the requested permission
            newPerms = newPerms.filter(p => !(p.scope === scope && p.action === action));

            // Rule 4: If removing view_status, remove ALL permissions for that scope
            if (scope.startsWith('service:') && action === 'view_status') {
                newPerms = newPerms.filter(p => p.scope !== scope);
            }

            // Rule 3: If removing View, remove Edit
            if (action === 'view_env') {
                newPerms = newPerms.filter(p => !(p.scope === scope && p.action === 'edit_env'));
            }
            if (action === 'view_configuration') {
                newPerms = newPerms.filter(p => !(p.scope === scope && p.action === 'edit_configuration'));
            }
        }
        setPerms(newPerms);
    };

    // Helper to toggle all perms for a service
    const toggleAllServicePerms = (serviceName: string, checked: boolean) => {
        const actions = ACTION_OPTIONS_SERVICE.map(o => o.value);
        let newPerms = [...perms];

        if (checked) {
            // Add all missing
            actions.forEach(action => {
                if (!newPerms.some(p => p.scope === `service:${serviceName}` && p.action === action)) {
                    newPerms.push({ scope: `service:${serviceName}`, action });
                }
            });
        } else {
            // Remove all
            newPerms = newPerms.filter(p => p.scope !== `service:${serviceName}`);
        }
        setPerms(newPerms);
    };

    const isAllServicePermsSelected = (serviceName: string) => {
        return ACTION_OPTIONS_SERVICE.every(a => hasPermission(`service:${serviceName}`, a.value));
    };


    const ACTION_OPTIONS_GLOBAL = [
        { value: 'pull_new_image', label: 'Pull New Images', desc: 'Allow pulling new docker images from registry' },
        { value: 'add_new_service', label: 'Add New Services', desc: 'Allow creating and starting new container services' },
    ];

    const ACTION_OPTIONS_SERVICE = [
        { value: 'view_status', label: 'View Status', desc: 'See if service is running or stopped' },
        { value: 'manage', label: 'Manage Service', desc: 'Start, Stop, Restart, and Delete the service' },
        { value: 'view_configuration', label: 'View Configuration', desc: 'Read-only access to service config' },
        { value: 'edit_configuration', label: 'Edit Configuration', desc: 'Modify service settings' },
        { value: 'view_env', label: 'View Environment', desc: 'Read-only access to .env variables' },
        { value: 'edit_env', label: 'Edit Environment', desc: 'Modify environment variables' },
        { value: 'view_logs', label: 'View Logs', desc: 'Stream real-time logs' },
    ];

    // Combine fetched services with any services already in permissions (even if not running)
    const allServiceNames = Array.from(new Set([
        ...services.map(s => s.name),
        ...perms.filter(p => p.scope.startsWith('service:')).map(p => p.scope.replace('service:', ''))
    ])).sort();

    return (
        <Drawer direction="right" open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Shield className="h-4 w-4" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[500px] rounded-none">
                <div className="mx-auto w-full h-full flex flex-col">
                    <DrawerHeader>
                        <DrawerTitle>Edit Permissions</DrawerTitle>
                        <DrawerDescription>
                            Configure access control for <span className="font-mono text-foreground">{user.username}</span>
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* GLOBAL PERMISSIONS */}
                        <Collapsible open={isGlobalOpen} onOpenChange={setIsGlobalOpen} className="border rounded-lg bg-card">
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 font-medium hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-primary" />
                                    Global Permissions
                                </div>
                                {isGlobalOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 pb-4 space-y-4">
                                <div className="grid gap-4 pl-6 border-l-2 ml-2">
                                    {ACTION_OPTIONS_GLOBAL.map((opt) => (
                                        <div key={opt.value} className="flex items-start space-x-3">
                                            <Checkbox
                                                id={`global-${opt.value}`}
                                                checked={hasPermission('global', opt.value)}
                                                onCheckedChange={(c: boolean | "indeterminate") => togglePermission('global', opt.value, c === true)}
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor={`global-${opt.value}`} className="font-medium cursor-pointer">
                                                    {opt.label}
                                                </Label>
                                                <p className="text-[0.8rem] text-muted-foreground">
                                                    {opt.desc}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        {/* SERVICE PERMISSIONS */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1">Service Permissions</h3>

                            {isLoadingServices ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading services...
                                </div>
                            ) : (
                                allServiceNames.map(serviceName => (
                                    <ServicePermissionGroup
                                        key={serviceName}
                                        serviceName={serviceName}
                                        hasPermission={hasPermission}
                                        togglePermission={togglePermission}
                                        toggleAll={toggleAllServicePerms}
                                        isAllSelected={isAllServicePermsSelected(serviceName)}
                                        options={ACTION_OPTIONS_SERVICE}
                                    />
                                ))
                            )}

                            {/* Manual Add Service */}
                            <div className="border rounded-lg bg-muted/20 p-4 mt-4">
                                <Label className="mb-2 block">Add Manual Service Scope</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Service name..."
                                        value={customService}
                                        onChange={e => setCustomService(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && customService) {
                                                // Just adding a permission triggers it to appear in the list
                                                togglePermission(`service:${customService}`, 'view_status', true);
                                                setCustomService("");
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="secondary"
                                        disabled={!customService}
                                        onClick={() => {
                                            togglePermission(`service:${customService}`, 'view_status', true);
                                            setCustomService("");
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Useful for adding permissions for services that are not currently running.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DrawerFooter className="border-t pt-4">
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Permissions
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

function ServicePermissionGroup({
    serviceName, hasPermission, togglePermission, toggleAll, isAllSelected, options
}: {
    serviceName: string,
    hasPermission: (scope: string, action: string) => boolean,
    togglePermission: (scope: string, action: string, checked: boolean) => void,
    toggleAll: (service: string, checked: boolean) => void,
    isAllSelected: boolean,
    options: { value: string, label: string, desc: string }[]
}) {
    const [isOpen, setIsOpen] = useState(false);
    // Auto-open if any permission is selected for this service
    useEffect(() => {
        if (options.some(o => hasPermission(`service:${serviceName}`, o.value))) {
            setIsOpen(true);
        }
    }, []);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg bg-card">
            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                    <Container className="h-4 w-4 text-blue-500" />
                    <span className="font-mono font-medium">{serviceName}</span>
                </CollapsibleTrigger>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-2">
                        <Checkbox
                            id={`all-${serviceName}`}
                            checked={isAllSelected}
                            onCheckedChange={(c: boolean | "indeterminate") => toggleAll(serviceName, c === true)}
                        />
                        <Label htmlFor={`all-${serviceName}`} className="text-xs text-muted-foreground cursor-pointer">
                            Select All
                        </Label>
                    </div>
                    <CollapsibleTrigger>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </CollapsibleTrigger>
                </div>
            </div>

            <CollapsibleContent className="px-4 pb-4 border-t bg-muted/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {options.map((opt) => (
                        <div key={opt.value} className="flex items-start space-x-3">
                            <Checkbox
                                id={`${serviceName}-${opt.value}`}
                                checked={hasPermission(`service:${serviceName}`, opt.value)}
                                onCheckedChange={(c: boolean | "indeterminate") => togglePermission(`service:${serviceName}`, opt.value, c === true)}
                            />
                            <div className="grid gap-1 leading-none">
                                <Label htmlFor={`${serviceName}-${opt.value}`} className="text-sm font-medium cursor-pointer">
                                    {opt.label}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {opt.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}
