import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import type { User, Permission } from '@/types';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { toast } from "sonner";
import { Plus, Trash2, Shield, RefreshCw } from "lucide-react";

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
                                        {user.permissions.length === 0 ? <span className="text-muted-foreground italic text-sm">No permissions</span> : null}
                                        {user.permissions.slice(0, 5).map((p, idx) => (
                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                                                {p.scope === 'global' ? 'Global' : p.scope.replace('service:', 'S:')}: {p.action}
                                            </span>
                                        ))}
                                        {user.permissions.length > 5 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                                +{user.permissions.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <EditPermissionsDialog user={user} onUpdated={fetchUsers} />
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

function EditPermissionsDialog({ user, onUpdated }: { user: User, onUpdated: () => void }) {
    const [open, setOpen] = useState(false);
    const [perms, setPerms] = useState<Permission[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New permission inputs
    const [newScope, setNewScope] = useState("global");
    const [newAction, setNewAction] = useState("");
    const [customService, setCustomService] = useState("");

    useEffect(() => {
        if (open) {
            setPerms([...user.permissions]);
        }
    }, [open, user]);

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await apiClient.patch(`/ api / users / ${user.username}/permissions`, {
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

    const addPermission = () => {
        const scope = newScope === 'service' ? `service:${customService}` : newScope;
        if (newScope === 'service' && !customService) {
            toast.error("Please enter a service name");
            return;
        }
        if (!newAction) {
            toast.error("Please select an action");
            return;
        }

        const newPerm = { scope, action: newAction };
        // Avoid duplicates
        if (perms.some(p => p.scope === newPerm.scope && p.action === newPerm.action)) {
            toast.error("Permission already exists");
            return;
        }
        setPerms([...perms, newPerm]);
        setNewAction(""); // Reset action for quicker entry
    };

    const removePermission = (index: number) => {
        const newPerms = [...perms];
        newPerms.splice(index, 1);
        setPerms(newPerms);
    };

    const SCOPE_OPTIONS = [
        { value: 'global', label: 'Global' },
        { value: 'service', label: 'Specific Service' }
    ];

    const ACTION_OPTIONS_GLOBAL = [
        { value: 'pull_new_image', label: 'Pull New Image' },
        { value: 'add_new_service', label: 'Add New Service' },
    ];

    const ACTION_OPTIONS_SERVICE = [
        { value: 'manage', label: 'Manage (Start/Stop/Delete)' },
        { value: 'view_status', label: 'View Status' },
        { value: 'view_configuration', label: 'View Config' },
        { value: 'edit_configuration', label: 'Edit Config' },
        { value: 'view_env', label: 'View Env' },
        { value: 'edit_env', label: 'Edit Env' },
        { value: 'view_logs', label: 'View Logs' },
    ];

    const currentActionOptions = newScope === 'global' ? ACTION_OPTIONS_GLOBAL : ACTION_OPTIONS_SERVICE;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Shield className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Permissions for {user.username}</DialogTitle>
                    <DialogDescription>
                        Add or remove permissions. Changes are applied immediately upon save.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Add New Permission Area */}
                    <div className="bg-muted/50 p-4 rounded-md space-y-4 border">
                        <h4 className="text-sm font-medium leading-none">Add Permission</h4>
                        <div className="flex gap-2 items-end">
                            <div className="grid gap-1.5 flex-1">
                                <Label className="text-xs">Scope</Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                                    value={newScope}
                                    onChange={e => setNewScope(e.target.value)}
                                >
                                    {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>

                            {newScope === 'service' && (
                                <div className="grid gap-1.5 flex-1">
                                    <Label className="text-xs">Service Name</Label>
                                    <Input
                                        value={customService}
                                        onChange={e => setCustomService(e.target.value)}
                                        placeholder="e.g. web-app"
                                        className="h-9"
                                    />
                                </div>
                            )}

                            <div className="grid gap-1.5 flex-1">
                                <Label className="text-xs">Action</Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                                    value={newAction}
                                    onChange={e => setNewAction(e.target.value)}
                                >
                                    <option value="">Select Action...</option>
                                    {currentActionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <Button onClick={addPermission} size="sm" type="button">Add</Button>
                        </div>
                    </div>

                    {/* Permission List */}
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Scope</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {perms.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground text-sm">
                                            No permissions assigned.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {perms.map((p, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-mono text-xs">{p.scope}</TableCell>
                                        <TableCell className="font-mono text-xs">{p.action}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePermission(idx)}>
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
