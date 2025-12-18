import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Settings } from 'lucide-react';
import { getApiConfig, setApiConfig, updateClientConfig } from '@/lib/api';
import { toast } from 'sonner';

export function SettingsDrawer() {
    const [open, setOpen] = useState(false);
    const [host, setHost] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (open) {
            const config = getApiConfig();
            setHost(config.host);
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
            window.location.reload();
        } catch (error) {
            toast.error('Failed to save configuration');
        }
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Server Configuration</DrawerTitle>
                        <DrawerDescription>
                            Set your Docker Manager server connection details.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pb-0">
                        <div className="grid gap-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="host" className="text-right">
                                    Host
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
                                    User
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
                                    Pass
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
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleSave}>Save changes</Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
