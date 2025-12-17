import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Settings } from 'lucide-react';
import { getApiConfig, setApiConfig, updateClientConfig } from '@/lib/api';
import { toast } from 'sonner';

export function SettingsDialog() {
    const [open, setOpen] = useState(false);
    const [host, setHost] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (open) {
            const config = getApiConfig();
            setHost(config.host);
            // We don't load password for security/simplicity, user must re-enter to change
        }
    }, [open]);

    const handleSave = () => {
        try {
            setApiConfig(host);
            if (username && password) {
                updateClientConfig(username, password);
            }
            toast.success('Configuration saved');
            setOpen(false);
            window.location.reload(); // Reload to apply changes cleanly
        } catch (error) {
            toast.error('Failed to save configuration');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Server Configuration</DialogTitle>
                    <DialogDescription>
                        Set your Docker Manager server connection details.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="host" className="text-right">
                            Host URL
                        </Label>
                        <Input
                            id="host"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            className="col-span-3"
                            placeholder="http://localhost:8080"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="username" className="text-right">
                            Username
                        </Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="col-span-3"
                            placeholder="admin"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                            Password
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="col-span-3"
                            placeholder="••••••"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
