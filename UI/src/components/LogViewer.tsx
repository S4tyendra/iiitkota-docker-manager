import { useRef, useEffect, useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getApiConfig } from '@/lib/api';
import { cn } from "@/lib/utils";
import {
    Pause,
    Play,
    Trash2,
    Download,
    Search,
    Copy,
    Check,
    ArrowDown,
    Terminal,
    AlertCircle,
    Info,
    AlertTriangle,
    XCircle,
    Maximize2,
    Minimize2,
} from 'lucide-react';
import { toast } from 'sonner';

interface LogLine {
    id: string;
    content: string;
    level: 'info' | 'warn' | 'error' | 'debug' | 'default';
}

function parseLogLevel(content: string): LogLine['level'] {
    const lower = content.toLowerCase();
    if (lower.includes('[error]') || lower.includes('error:') || lower.includes('err:') || lower.includes('fatal')) {
        return 'error';
    }
    if (lower.includes('[warn]') || lower.includes('warning:') || lower.includes('warn:')) {
        return 'warn';
    }
    if (lower.includes('[debug]') || lower.includes('debug:')) {
        return 'debug';
    }
    if (lower.includes('[info]') || lower.includes('info:')) {
        return 'info';
    }
    return 'default';
}

function getLevelStyles(level: LogLine['level']) {
    switch (level) {
        case 'error':
            return {
                bg: 'bg-red-500/10',
                border: 'border-l-red-500',
                icon: XCircle,
                iconColor: 'text-red-400',
            };
        case 'warn':
            return {
                bg: 'bg-amber-500/10',
                border: 'border-l-amber-500',
                icon: AlertTriangle,
                iconColor: 'text-amber-400',
            };
        case 'info':
            return {
                bg: 'bg-blue-500/5',
                border: 'border-l-blue-500',
                icon: Info,
                iconColor: 'text-blue-400',
            };
        case 'debug':
            return {
                bg: 'bg-purple-500/5',
                border: 'border-l-purple-500',
                icon: Terminal,
                iconColor: 'text-purple-400',
            };
        default:
            return {
                bg: '',
                border: 'border-l-transparent',
                icon: null,
                iconColor: '',
            };
    }
}


interface EmbeddedLogViewerProps {
    serviceId: string;
    serviceName: string;
    className?: string;
}

export function EmbeddedLogViewer({ serviceId, serviceName, className }: EmbeddedLogViewerProps) {
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

    const abortController = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pausedLogs = useRef<LogLine[]>([]);
    const logCounter = useRef(0);

    const parseLogChunk = useCallback((chunk: string): LogLine[] => {
        const lines = chunk.split('\n').filter(line => line.trim());
        return lines.map(line => {
            logCounter.current += 1;
            return {
                id: `log-${logCounter.current}-${Date.now()}`,
                content: line,
                level: parseLogLevel(line),
            };
        });
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            setAutoScroll(true);
        }
    };

    const copyLog = async (id: string, content: string) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const copyAllLogs = async () => {
        const content = logs.map(l => l.content).join('\n');
        await navigator.clipboard.writeText(content);
        toast.success('All logs copied to clipboard');
    };

    const downloadLogs = () => {
        const content = logs.map(l => l.content).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${serviceName}-logs-${new Date().toISOString().split('T')[0]}.log`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Logs downloaded');
    };

    const clearLogs = () => {
        setLogs([]);
        logCounter.current = 0;
        toast.success('Logs cleared');
    };

    const togglePause = () => {
        if (isPaused) {
            setLogs(prev => [...prev, ...pausedLogs.current]);
            pausedLogs.current = [];
        }
        setIsPaused(!isPaused);
    };

    useEffect(() => {
        if (!serviceId) return;

        setLogs([]);
        logCounter.current = 0;
        setConnectionStatus('connecting');
        abortController.current = new AbortController();

        const fetchLogs = async () => {
            const { host, auth } = getApiConfig();
            const url = `${host}/services/${serviceId}/logs`;

            try {
                const response = await fetch(url, {
                    headers: auth ? { 'Authorization': `Basic ${auth}` } : {},
                    signal: abortController.current?.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                if (!response.body) throw new Error('No response body');

                setConnectionStatus('connected');
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        setConnectionStatus('disconnected');
                        break;
                    }

                    const chunk = decoder.decode(value);
                    const newLines = parseLogChunk(chunk);

                    if (isPaused) {
                        pausedLogs.current = [...pausedLogs.current, ...newLines];
                    } else {
                        setLogs(prev => [...prev, ...newLines]);
                    }

                    if (autoScroll && scrollRef.current) {
                        requestAnimationFrame(() => {
                            if (scrollRef.current) {
                                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                            }
                        });
                    }
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    setConnectionStatus('error');
                    const errorLine = parseLogChunk(`[ERROR] Connection failed: ${err.message}`);
                    setLogs(prev => [...prev, ...errorLine]);
                }
            }
        };

        fetchLogs();

        return () => {
            abortController.current?.abort();
        };
    }, [serviceId, parseLogChunk, autoScroll, isPaused]);

    const filteredLogs = searchTerm
        ? logs.filter(l => l.content.toLowerCase().includes(searchTerm.toLowerCase()))
        : logs;

    const errorCount = logs.filter(l => l.level === 'error').length;
    const warnCount = logs.filter(l => l.level === 'warn').length;

    return (
        <div className={cn("flex flex-col h-[60vh] gap-3", className)}>
            {/* Header with Status */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Terminal className="h-4 w-4 text-emerald-500" />
                        <span className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-background",
                            connectionStatus === 'connected' && "bg-emerald-500 animate-pulse",
                            connectionStatus === 'connecting' && "bg-amber-500 animate-pulse",
                            connectionStatus === 'disconnected' && "bg-muted-foreground",
                            connectionStatus === 'error' && "bg-red-500",
                        )} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {connectionStatus === 'connected' && 'Live streaming'}
                        {connectionStatus === 'connecting' && 'Connecting...'}
                        {connectionStatus === 'disconnected' && 'Stream ended'}
                        {connectionStatus === 'error' && 'Connection failed'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {errorCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                            <XCircle className="h-2.5 w-2.5 mr-1" />
                            {errorCount}
                        </Badge>
                    )}
                    {warnCount > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-amber-500 border-amber-500/30 bg-amber-500/10">
                            <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                            {warnCount}
                        </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        {logs.length} lines
                    </Badge>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Filter logs..."
                        className="h-8 pl-8 text-xs bg-background/50 border-muted-foreground/20 focus:bg-background transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant={isPaused ? "default" : "ghost"}
                        size="sm"
                        onClick={togglePause}
                        className={cn("h-7 px-2 text-xs", isPaused && "bg-amber-500 hover:bg-amber-600")}
                    >
                        {isPaused ? (
                            <>
                                <Play className="h-3.5 w-3.5 mr-1" />
                                Resume
                                {pausedLogs.current.length > 0 && (
                                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                                        +{pausedLogs.current.length}
                                    </Badge>
                                )}
                            </>
                        ) : (
                            <>
                                <Pause className="h-3.5 w-3.5 mr-1" />
                                Pause
                            </>
                        )}
                    </Button>

                    <div className="w-px h-5 bg-border mx-1" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={copyAllLogs}
                        title="Copy all logs"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={downloadLogs}
                        title="Download logs"
                    >
                        <Download className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={clearLogs}
                        title="Clear logs"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Log Content */}
            <div className="flex-1 min-h-0 border rounded-lg bg-card/40 overflow-hidden relative">
                <ScrollArea
                    ref={scrollRef}
                    className="h-[55vh]"
                    onScroll={handleScroll}
                >
                    <div className="font-mono text-xs">
                        {filteredLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                                    <Terminal className="h-6 w-6 text-muted-foreground/50" />
                                </div>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {searchTerm ? 'No matching logs' : 'Waiting for logs...'}
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                    {searchTerm ? 'Try adjusting your search filter' : 'Logs will appear here in real-time'}
                                </p>
                            </div>
                        ) : (
                            filteredLogs.map((log, index) => {
                                const styles = getLevelStyles(log.level);
                                const Icon = styles.icon;
                                const isCopied = copiedId === log.id;

                                return (
                                    <div
                                        key={log.id}
                                        className={cn(
                                            "group flex items-start gap-2 px-3 py-1 border-l-2 hover:bg-muted/50 transition-colors",
                                            styles.bg,
                                            styles.border,
                                        )}
                                    >
                                        {/* Line Number */}
                                        <span className="w-6 text-right text-muted-foreground/50 select-none shrink-0 tabular-nums">
                                            {index + 1}
                                        </span>

                                        {/* Level Icon */}
                                        {Icon && (
                                            <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", styles.iconColor)} />
                                        )}

                                        {/* Content */}
                                        <span className={cn(
                                            "flex-1 whitespace-pre-wrap break-all",
                                            log.level === 'error' && "text-red-400",
                                            log.level === 'warn' && "text-amber-400",
                                            log.level === 'debug' && "text-purple-400",
                                        )}>
                                            {log.content}
                                        </span>

                                        {/* Copy Button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            onClick={() => copyLog(log.id, log.content)}
                                        >
                                            {isCopied ? (
                                                <Check className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>

                {/* Scroll to bottom button */}
                {!autoScroll && logs.length > 0 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                        <Button
                            size="sm"
                            onClick={scrollToBottom}
                            className="h-7 px-3 text-xs shadow-lg bg-primary/90 backdrop-blur-sm"
                        >
                            <ArrowDown className="h-3 w-3 mr-1" />
                            Scroll to bottom
                        </Button>
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 text-amber-500/80" />
                    <span>Logs stream in real-time. Older logs may not be available.</span>
                </div>
                <div className="flex items-center gap-3">
                    {isPaused && (
                        <span className="text-amber-500 font-medium animate-pulse">PAUSED</span>
                    )}
                    <span className="tabular-nums">{filteredLogs.length} / {logs.length} lines</span>
                </div>
            </div>
        </div>
    );
}



interface LogViewerProps {
    serviceId: string | null;
    serviceName: string;
    onClose: () => void;
}

export function LogViewer({ serviceId, serviceName, onClose }: LogViewerProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <Dialog open={!!serviceId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={cn(
                "flex flex-col p-0 gap-0 overflow-hidden",
                isFullscreen
                    ? "sm:max-w-[100vw] h-screen rounded-none"
                    : "sm:max-w-4xl h-[85vh]"
            )}>
                {/* Header */}
                <DialogHeader className="px-4 py-3 border-b bg-linear-to-r from-background via-background to-muted/30 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <DialogTitle className="text-base font-semibold flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-emerald-500" />
                            {serviceName}
                        </DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </DialogHeader>

                {/* Embedded Viewer */}
                <div className="flex-1 p-4 overflow-hidden">
                    {serviceId && (
                        <EmbeddedLogViewer
                            serviceId={serviceId}
                            serviceName={serviceName}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
