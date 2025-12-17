import { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Download, Loader2 } from 'lucide-react';
import { getApiConfig } from '@/lib/api';

export function ImagePuller() {
    const [open, setOpen] = useState(false);
    const [image, setImage] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [pulling, setPulling] = useState(false);
    const abortController = useRef<AbortController | null>(null);

    const handlePull = async (e: React.FormEvent) => {
        e.preventDefault();
        setPulling(true);
        setLogs([]);

        abortController.current = new AbortController();
        const { host, auth } = getApiConfig();

        try {
            const response = await fetch(`${host}/images/pull?image=${image}`, {
                headers: auth ? { 'Authorization': `Basic ${auth}` } : {},
                signal: abortController.current?.signal,
            });

            if (!response.body) throw new Error('No body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                // Process lines (often single chunk contains multiple json lines)
                const lines = chunk.split('\n').filter(Boolean);
                lines.forEach(line => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const json = JSON.parse(line);
                        // Maybe format it better? for now just status
                        setLogs(prev => [...prev, `${json.status} ${json.id || ''} ${json.progress || ''}`]);
                    } catch {
                        setLogs(prev => [...prev, line]);
                    }
                });
            }
        } catch (err: any) {
            setLogs(prev => [...prev, `Error: ${err.message}`]);
        } finally {
            setPulling(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                    <Download className="mr-2 h-4 w-4" /> Pull Image
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Pull Docker Image</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePull} className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            value={image}
                            onChange={e => setImage(e.target.value)}
                            placeholder="ghcr.io/owner/repo:latest"
                            disabled={pulling}
                        />
                        <Button type="submit" disabled={pulling}>
                            {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pull'}
                        </Button>
                    </div>
                </form>
                {logs.length > 0 && (
                    <div className="h-48 overflow-auto bg-black text-white text-xs p-2 rounded font-mono">
                        {logs.map((L, i) => <div key={i}>{L}</div>)}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
