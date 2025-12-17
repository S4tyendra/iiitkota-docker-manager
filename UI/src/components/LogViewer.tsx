import { useRef, useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getApiConfig } from '@/lib/api';

interface LogViewerProps {
    serviceId: string | null;
    serviceName: string;
    onClose: () => void;
}

export function LogViewer({ serviceId, serviceName, onClose }: LogViewerProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const abortController = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!serviceId) return;

        setLogs([`Connecting to logs for ${serviceName}...`]);
        abortController.current = new AbortController();

        const fetchLogs = async () => {
            const { host, auth } = getApiConfig();
            const url = `${host}/services/${serviceId}/logs`;

            try {
                const response = await fetch(url, {
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
                    setLogs(prev => [...prev, chunk]); // Naive append, might need split by newline

                    // Auto scroll
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    setLogs(prev => [...prev, `\nError: ${err.message}`]);
                }
            }
        };

        fetchLogs();

        return () => {
            abortController.current?.abort();
        };
    }, [serviceId, serviceName]);

    return (
        <Dialog open={!!serviceId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Logs: {serviceName}</DialogTitle>
                </DialogHeader>
                <div ref={scrollRef} className="flex-1 overflow-auto bg-black text-white font-mono p-4 rounded text-xs whitespace-pre-wrap">
                    {logs.join('')}
                </div>
            </DialogContent>
        </Dialog>
    );
}
