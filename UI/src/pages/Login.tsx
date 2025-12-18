import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getStoredServerUrl } from '@/lib/api';
import { HelpCircle } from 'lucide-react';

export default function Login() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [serverUrl, setServerUrl] = useState(getStoredServerUrl() || 'http://localhost:8080');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(serverUrl, username, password);
            toast.success("Logged in successfully");
            navigate('/', { replace: true });
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to login");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Orchestr8 Login</CardTitle>
                    <CardDescription>Enter your credentials to access the manager</CardDescription>
                    <CardDescription>
                        <p className="text-xs font-bold">
                            Read Documentation: <a className='text-blue-500 underline' href="https://github.com/s4tyendra/Orchestr8" target="_blank">https://github.com/s4tyendra/Orchestr8</a>
                        </p>
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="serverUrl" className="flex items-center gap-2">
                                Server URL
                                <div title={`The URL where the Orchestr8 API is running.\n\nNote: If the server is on a different domain/port, ensure you have added ${window.location.host} to ALLOWED_ORIGINS in your server's .env file.`}>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                </div>
                            </Label>
                            <Input
                                id="serverUrl"
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                required
                                placeholder="http://localhost:8080"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder="admin"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                            {isLoading ? "Logging in..." : "Login"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
