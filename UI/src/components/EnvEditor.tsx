import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
    Plus,
    Trash2,
    Code2,
    Table2,
    AlertCircle,
    Eye,
    EyeOff,
    Copy,
    Check,
    Search,
    Lock,
    Unlock
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

interface EnvVar {
    key: string;
    value: string;
    id: string;
    isSecret: boolean;
}

interface EnvEditorProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

function parseEnvContent(content: string): EnvVar[] {
    const lines = content.split('\n');
    const vars: EnvVar[] = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match) {
            const [, key, rawValue] = match;
            let value = rawValue;
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            vars.push({
                key,
                value,
                id: `env-${index}-${Date.now()}`,
                isSecret: isSecretKey(key)
            });
        }
    });

    return vars;
}

function serializeEnvVars(vars: EnvVar[]): string {
    return vars
        .filter(v => v.key.trim()) 
        .map(v => {
            const key = v.key.trim();
            let value = v.value;

            if (value.includes(' ') || value.includes('#') || value.includes('=')) {
                value = `"${value}"`;
            }

            return `${key}=${value}`;
        })
        .join('\n');
}

function isSecretKey(key: string): boolean {
    const secretPatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /api[_-]?key/i,
        /private/i,
        /credential/i,
        /auth/i,
        /jwt/i,
        /access[_-]?key/i,
        /ssh/i,
        /encryption/i,
        /cert/i,
    ];
    return secretPatterns.some(pattern => pattern.test(key));
}

function getEnvCategoryColor(key: string): string {
    const upper = key.toUpperCase();

    if (upper.includes('DB') || upper.includes('DATABASE') || upper.includes('MYSQL') ||
        upper.includes('POSTGRES') || upper.includes('MONGO') || upper.includes('REDIS')) {
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
    if (upper.includes('API') || upper.includes('ENDPOINT') || upper.includes('URL') ||
        upper.includes('HOST') || upper.includes('PORT')) {
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
    if (isSecretKey(key)) {
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    }
    if (upper.includes('NODE') || upper.includes('ENV') || upper.includes('DEBUG') ||
        upper.includes('LOG')) {
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    }
    return 'bg-muted text-muted-foreground border-border';
}

export function EnvEditor({ value, onChange, disabled = false }: EnvEditorProps) {
    const [isVisualMode, setIsVisualMode] = useState(true);
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [rawContent, setRawContent] = useState(value);
    const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setRawContent(value);
        try {
            const parsed = parseEnvContent(value);
            setEnvVars(parsed);
            setParseError(null);
        } catch (e) {
            setParseError('Failed to parse environment variables');
        }
    }, [value]);

    const syncToParent = useCallback((vars: EnvVar[]) => {
        const serialized = serializeEnvVars(vars);
        setRawContent(serialized);
        onChange(serialized);
    }, [onChange]);

    const handleRawChange = (newRaw: string) => {
        setRawContent(newRaw);
        onChange(newRaw);
        try {
            const parsed = parseEnvContent(newRaw);
            setEnvVars(parsed);
            setParseError(null);
        } catch (e) {
            setParseError('Failed to parse');
        }
    };

    const addVariable = () => {
        const newVar: EnvVar = {
            key: '',
            value: '',
            id: `env-new-${Date.now()}`,
            isSecret: false
        };
        const newVars = [...envVars, newVar];
        setEnvVars(newVars);
       
    };

    const updateVariable = (id: string, field: 'key' | 'value', newValue: string) => {
        const newVars = envVars.map(v => {
            if (v.id === id) {
                const updated = { ...v, [field]: newValue };
                if (field === 'key') {
                    updated.isSecret = isSecretKey(newValue);
                }
                return updated;
            }
            return v;
        });
        setEnvVars(newVars);
        syncToParent(newVars);
    };

    const deleteVariable = (id: string) => {
        const newVars = envVars.filter(v => v.id !== id);
        setEnvVars(newVars);
        syncToParent(newVars);
    };

    const toggleSecretVisibility = (id: string) => {
        setVisibleSecrets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const copyValue = async (id: string, value: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedId(id);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleAllSecrets = () => {
        if (visibleSecrets.size === envVars.length) {
            setVisibleSecrets(new Set());
        } else {
            const allIds = new Set(envVars.map(v => v.id));
            setVisibleSecrets(allIds);
        }
    };

    const filteredVars = useMemo(() => {
        if (!searchTerm) return envVars;
        const term = searchTerm.toLowerCase();
        return envVars.filter(v =>
            v.key.toLowerCase().includes(term) ||
            v.value.toLowerCase().includes(term)
        );
    }, [envVars, searchTerm]);

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 p-1">
                <div className="flex items-center flex-1 gap-2 max-w-sm">
                    <div className="relative w-full">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter variables..."
                            className="pl-9 h-9 text-sm bg-muted/30 border-muted-foreground/20 focus:bg-background transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={!isVisualMode || disabled}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex items-center p-1 bg-muted/50 rounded-lg border border-border/50">
                        <Button
                            variant={isVisualMode ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setIsVisualMode(true)}
                            className={cn("h-7 px-3 text-xs", isVisualMode && "bg-background shadow-sm")}
                            disabled={disabled}
                        >
                            <Table2 className="h-3.5 w-3.5 mr-1.5" />
                            Visual
                        </Button>
                        <Button
                            variant={!isVisualMode ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setIsVisualMode(false)}
                            className={cn("h-7 px-3 text-xs", !isVisualMode && "bg-background shadow-sm")}
                            disabled={disabled}
                        >
                            <Code2 className="h-3.5 w-3.5 mr-1.5" />
                            Raw
                        </Button>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {parseError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
                    <AlertCircle className="h-4 w-4" />
                    {parseError}
                </div>
            )}

            {/* Editor Area */}
            <div className="flex-1 min-h-0 border rounded-lg bg-card/40 overflow-hidden relative">
                {isVisualMode ? (
                    <div className="flex flex-col h-[45vh]">
                        {/* Header Row */}
                        <div className="grid grid-cols-[1fr_1.5fr_auto] gap-4 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <div>Key</div>
                            <div className="flex items-center justify-between">
                                <span>Value</span>
                                <div className='flex items-center gap-3'>
                                    {envVars.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 p-0 hover:bg-transparent"
                                            onClick={toggleAllSecrets}
                                            title={visibleSecrets.size === envVars.length ? "Hide all" : "Show all"}
                                        >
                                            {visibleSecrets.size === envVars.length ?
                                                <Unlock className="h-3 w-3" /> :
                                                <Lock className="h-3 w-3" />
                                            }
                                        </Button>
                                    )}
                                    {/* Sticky Bottom Bar */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0 hover:bg-transparent"
                                        onClick={addVariable}
                                        disabled={disabled}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="w-8"></div>
                        </div>

                        {/* Valid Content */}
                        <ScrollArea className="flex-1 overflow-scroll">
                            <div className="p-2 space-y-1">
                                {filteredVars.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                                            <Search className="h-6 w-6 text-muted-foreground/50" />
                                        </div>
                                        <p className="text-sm text-muted-foreground font-medium">No variables found</p>
                                        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
                                            {searchTerm ? "Try adjusting your search query" : "Get started by adding a new variable"}
                                        </p>
                                        {!searchTerm && (
                                            <Button variant="ghost" size="icon" onClick={addVariable} className="mt-4">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    filteredVars.map((envVar) => {
                                        const isVisible = visibleSecrets.has(envVar.id);
                                        const isCopied = copiedId === envVar.id;
                                        const categoryClass = getEnvCategoryColor(envVar.key);

                                        return (
                                            <div
                                                key={envVar.id}
                                                className="group grid grid-cols-[1fr_1.5fr_auto] gap-3 items-center p-2 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                                            >
                                                {/* Key Input */}
                                                <div className="relative">
                                                    <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-md transition-colors", categoryClass.replace('bg-', 'bg-').split(' ')[0])} />
                                                    <Input
                                                        value={envVar.key}
                                                        onChange={(e) => updateVariable(envVar.id, 'key', e.target.value)}
                                                        placeholder="KEY"
                                                        className="h-8 pl-3 font-mono text-xs bg-transparent border-0 ring-1 ring-border/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-background transition-all"
                                                        disabled={disabled}
                                                    />
                                                </div>

                                                {/* Value Input */}
                                                <div className="relative group/value">
                                                    <Input
                                                        type={envVar.isSecret && !isVisible ? "password" : "text"}
                                                        value={envVar.value}
                                                        onChange={(e) => updateVariable(envVar.id, 'value', e.target.value)}
                                                        placeholder="Value"
                                                        className="h-8 font-mono text-xs pr-14 bg-transparent border-0 ring-1 ring-border/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-background transition-all"
                                                        disabled={disabled}
                                                    />

                                                    {/* Value Actions */}
                                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover/value:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md shadow-sm border border-border/50">
                                                        {envVar.isSecret && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => toggleSecretVisibility(envVar.id)}
                                                                className="h-6 w-6 p-0 hover:bg-muted"
                                                            >
                                                                {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyValue(envVar.id, envVar.value)}
                                                            className="h-6 w-6 p-0 hover:bg-muted"
                                                        >
                                                            {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Row Actions */}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteVariable(envVar.id)}
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100"
                                                    disabled={disabled}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="relative h-full">
                        <Textarea
                            className="font-mono h-[45vh] w-full p-4 text-xs leading-relaxed whitespace-pre bg-transparent border-0 resize-none focus-visible:ring-0"
                            placeholder="# Environment variables&#10;KEY=value&#10;DATABASE_URL=postgres://..."
                            value={rawContent}
                            onChange={(e) => handleRawChange(e.target.value)}
                            disabled={disabled}
                        />
                        <div className="absolute bottom-4 right-4 text-[10px] text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded border shadow-sm">
                            Lines starting with # are comments
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-start gap-2 text-[10px] text-muted-foreground px-1">
                <AlertCircle className="h-3 w-3 mt-0.5 text-amber-500/80" />
                <p>Changes will trigger a service restart. Secrets are automatically detected.</p>
            </div>
        </div>
    );
}
