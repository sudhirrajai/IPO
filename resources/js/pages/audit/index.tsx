import { Head, router } from '@inertiajs/react';
import {
    Activity,
    CreditCard,
    DollarSign,
    Download,
    FileText,
    Filter,
    Search,
    ShieldAlert,
    TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { AuditLog, BreadcrumbItem } from '@/types';

interface AuditIndexProps {
    logs: {
        data: AuditLog[];
        current_page: number;
        last_page: number;
        total: number;
    };
    filters: {
        action?: string;
        search?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Audit Logs',
        href: '/audit-logs',
    },
];

export default function AuditIndex({ logs, filters }: AuditIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [actionFilter, setActionFilter] = useState(filters.action || 'all');

    const handleFilterChange = (key: string, value: string) => {
        const query: Record<string, string> = {
            search,
            action: actionFilter,
            [key]: value,
        };

        if (query.action === 'all' || !query.action) delete query.action;
        if (!query.search) delete query.search;

        router.get('/audit-logs', query, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="System & Security Audit Logs" />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                        Security & Financial Audit Trail
                    </h1>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Immutable record of PAN unmasking events, rate adjustments, batch settlements, and exports.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search description, action, or IP..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange('search', search)}
                            className="pl-9"
                        />
                    </div>

                    <Select
                        value={actionFilter}
                        onValueChange={(val) => {
                            setActionFilter(val);
                            handleFilterChange('action', val);
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="rate_changed">Rate Changed</SelectItem>
                            <SelectItem value="pan_revealed">PAN Revealed</SelectItem>
                            <SelectItem value="pan_created">PAN Created</SelectItem>
                            <SelectItem value="batch_created">Batch Created</SelectItem>
                            <SelectItem value="batch_settled">Batch Settled</SelectItem>
                            <SelectItem value="csv_exported">CSV Exported</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Audit Logs Table */}
                <Card>
                    <CardContent className="p-0">
                        {logs.data.length === 0 ? (
                            <p className="py-8 text-center text-sm text-neutral-500">No audit events match your query.</p>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
                                    <tr>
                                        <th className="py-3 px-3 w-12 text-center">#</th>
                                        <th className="py-3 px-4">Action</th>
                                        <th className="py-3 px-4">Description</th>
                                        <th className="py-3 px-4">Initiated By</th>
                                        <th className="py-3 px-4">IP Address</th>
                                        <th className="py-3 px-4">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                    {logs.data.map((log, index) => {
                                        const rowNumber = (logs.current_page - 1) * 25 + index + 1;
                                        return (
                                            <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                                                <td className="py-3 px-3 text-center text-xs font-mono text-neutral-400 dark:text-neutral-500 font-semibold">
                                                    {rowNumber}
                                                </td>
                                                <td className="py-3 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 ${
                                                        log.action === 'pan_revealed'
                                                            ? 'border-red-500/40 text-red-600 bg-red-500/10 dark:text-red-400'
                                                            : log.action === 'rate_changed'
                                                            ? 'border-blue-500/40 text-blue-600 bg-blue-500/10 dark:text-blue-400'
                                                            : log.action === 'batch_settled'
                                                            ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400'
                                                            : 'border-neutral-400/40 text-neutral-700 bg-neutral-500/10 dark:text-neutral-300'
                                                    }`}
                                                >
                                                    {log.action.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                                                {log.description}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-neutral-600 dark:text-neutral-400">
                                                {log.user?.name || 'System'}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-xs text-neutral-500">
                                                {log.ip_address || '127.0.0.1'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-neutral-500">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
