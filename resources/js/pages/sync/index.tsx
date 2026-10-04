import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    ExternalLink,
    Eye,
    EyeOff,
    Key,
    RefreshCw,
    Save,
    Server,
    TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, SyncLog } from '@/types';

interface SyncIndexProps {
    currentProvider: string;
    credentials?: {
        ipoalerts_api_key?: string;
        upstox_api_key?: string;
        upstox_access_token?: string;
    };
    lastGmpScrapeAt?: string | null;
    lastGmpStats?: {
        total_scraped: number;
        matched: number;
        updated: number;
        duration_ms: number;
    } | null;
    logs: SyncLog[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Provider & Sync',
        href: '/sync',
    },
];

export default function SyncIndex({ currentProvider, credentials, lastGmpScrapeAt, lastGmpStats, logs }: SyncIndexProps) {
    const [selectedProvider, setSelectedProvider] = useState(currentProvider || 'mock');
    const [isSyncing, setIsSyncing] = useState(false);
    const [isScrapingGmp, setIsScrapingGmp] = useState(false);
    const [isSavingCreds, setIsSavingCreds] = useState(false);

    // API Keys state
    const [ipoAlertsKey, setIpoAlertsKey] = useState(credentials?.ipoalerts_api_key || '');
    const [upstoxKey, setUpstoxKey] = useState(credentials?.upstox_api_key || '');
    const [upstoxToken, setUpstoxToken] = useState(credentials?.upstox_access_token || '');

    const [showIpoAlertsKey, setShowIpoAlertsKey] = useState(false);
    const [showUpstoxKey, setShowUpstoxKey] = useState(false);
    const [showUpstoxToken, setShowUpstoxToken] = useState(false);

    const handleRunSync = () => {
        setIsSyncing(true);
        router.post('/sync/run', { provider: selectedProvider }, {
            onFinish: () => setIsSyncing(false),
        });
    };

    const handleScrapeGmp = () => {
        setIsScrapingGmp(true);
        router.post('/sync/gmp', {}, {
            onFinish: () => setIsScrapingGmp(false),
        });
    };

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingCreds(true);
        router.post('/sync/settings', {
            ipo_provider: selectedProvider,
            ipoalerts_api_key: ipoAlertsKey,
            upstox_api_key: upstoxKey,
            upstox_access_token: upstoxToken,
        }, {
            onFinish: () => setIsSavingCreds(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="IPO Provider Sync & API Settings" />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                            IPO Provider Synchronization & API Keys
                        </h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Configure API credentials, switch active data providers, and run manual or scheduled sync.
                        </p>
                    </div>

                    <Button
                        onClick={handleRunSync}
                        disabled={isSyncing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Synchronizing...' : 'Sync IPOs Now'}
                    </Button>
                </div>

                {/* API Credentials & Provider Settings Form */}
                <form onSubmit={handleSaveSettings} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Key className="h-5 w-5 text-emerald-600" />
                                <CardTitle className="text-base font-semibold">API Credentials & Provider Selection</CardTitle>
                            </div>
                            <CardDescription>
                                Set your provider credentials here or in your <code>.env</code> file. Values saved here take immediate effect.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* Provider Selection */}
                            <div className="space-y-2">
                                <Label htmlFor="provider_select">Active IPO Provider</Label>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                        <SelectTrigger className="w-full sm:w-[320px]">
                                            <SelectValue placeholder="Choose provider..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="mock">Mock Sandbox Feeder (Offline / Demo)</SelectItem>
                                            <SelectItem value="ipoalerts">IPO Alerts API (https://ipoalerts.in)</SelectItem>
                                            <SelectItem value="upstox">Upstox Market API (v2)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Badge variant="outline" className="text-xs uppercase font-mono py-1 px-2.5">
                                        Current: {selectedProvider}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                                {/* IPO Alerts Credentials */}
                                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 bg-neutral-50/50 dark:bg-neutral-900/50">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                            1. IPO Alerts API
                                        </h4>
                                        <span className="text-[11px] text-neutral-400 font-mono">ipoalerts.in</span>
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        Endpoint: <code>https://api.ipoalerts.in/v1/ipos</code>
                                    </p>

                                    <div className="space-y-1">
                                        <Label htmlFor="ipoalerts_key" className="text-xs">API Key (or env: IPO_ALERTS_API_KEY)</Label>
                                        <div className="relative">
                                            <Input
                                                id="ipoalerts_key"
                                                type={showIpoAlertsKey ? 'text' : 'password'}
                                                placeholder="Enter IPO Alerts API Key..."
                                                value={ipoAlertsKey}
                                                onChange={(e) => setIpoAlertsKey(e.target.value)}
                                                className="pr-10 font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                                                onClick={() => setShowIpoAlertsKey(!showIpoAlertsKey)}
                                            >
                                                {showIpoAlertsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Upstox Credentials */}
                                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 bg-neutral-50/50 dark:bg-neutral-900/50">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                            2. Upstox API (v2)
                                        </h4>
                                        <span className="text-[11px] text-neutral-400 font-mono">api.upstox.com</span>
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        Endpoint: <code>https://api.upstox.com/v2/market/ipo</code>
                                    </p>

                                    <div className="space-y-1">
                                        <Label htmlFor="upstox_key" className="text-xs">API Key (or env: UPSTOX_API_KEY)</Label>
                                        <div className="relative">
                                            <Input
                                                id="upstox_key"
                                                type={showUpstoxKey ? 'text' : 'password'}
                                                placeholder="Enter Upstox API Key..."
                                                value={upstoxKey}
                                                onChange={(e) => setUpstoxKey(e.target.value)}
                                                className="pr-10 font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                                                onClick={() => setShowUpstoxKey(!showUpstoxKey)}
                                            >
                                                {showUpstoxKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="upstox_token" className="text-xs">Access Token (or env: UPSTOX_ACCESS_TOKEN)</Label>
                                        <div className="relative">
                                            <Input
                                                id="upstox_token"
                                                type={showUpstoxToken ? 'text' : 'password'}
                                                placeholder="Enter Upstox Bearer Token..."
                                                value={upstoxToken}
                                                onChange={(e) => setUpstoxToken(e.target.value)}
                                                className="pr-10 font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                                                onClick={() => setShowUpstoxToken(!showUpstoxToken)}
                                            >
                                                {showUpstoxToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button type="submit" disabled={isSavingCreds} className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
                                    <Save className="mr-2 h-4 w-4" />
                                    {isSavingCreds ? 'Saving Settings...' : 'Save API Settings'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>

                {/* InvestorGain Live GMP Scraper & Background Cron Card */}
                <Card className="border-blue-200/80 dark:border-blue-900/60 bg-linear-to-br from-blue-50/40 via-white to-neutral-50/50 dark:from-blue-950/20 dark:via-neutral-900 dark:to-neutral-900">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    <CardTitle className="text-base font-semibold">InvestorGain Live GMP Scraper</CardTitle>
                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                        Background Cron: Every 30 Mins
                                    </Badge>
                                </div>
                                <CardDescription>
                                    Scrapes real-time Grey Market Premium (GMP) and subscription data from{' '}
                                    <a
                                        href="https://www.investorgain.com/report/ipo-gmp-live/331/"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono text-xs"
                                    >
                                        investorgain.com/report/ipo-gmp-live/331/ <ExternalLink className="h-3 w-3" />
                                    </a>
                                    {' '}and maps it to Mainboard & SME IPOs in your database.
                                </CardDescription>
                            </div>

                            <Button
                                onClick={handleScrapeGmp}
                                disabled={isScrapingGmp}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-fit"
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isScrapingGmp ? 'animate-spin' : ''}`} />
                                {isScrapingGmp ? 'Scraping Live GMP...' : 'Scrape Live GMP Now'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/50">
                                <span className="text-neutral-500 block mb-1">Cron Frequency</span>
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-blue-500" /> Every 30 Minutes
                                </span>
                            </div>

                            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/50">
                                <span className="text-neutral-500 block mb-1">Last Scraped At</span>
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                    {lastGmpScrapeAt
                                        ? new Date(lastGmpScrapeAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                                        : 'Never'}
                                </span>
                            </div>

                            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/50">
                                <span className="text-neutral-500 block mb-1">Matched IPOs</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {lastGmpStats?.matched ?? '—'} / {lastGmpStats?.total_scraped ?? '—'} Scraped
                                </span>
                            </div>

                            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/50">
                                <span className="text-neutral-500 block mb-1">Command Line Trigger</span>
                                <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                                    php artisan ipo:scrape-gmp
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sync History Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Recent Synchronization Logs</CardTitle>
                        <CardDescription>Audit of all automated and manual provider sync runs</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {logs.length === 0 ? (
                            <p className="py-8 text-center text-sm text-neutral-500">No synchronization records yet.</p>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
                                    <tr>
                                        <th className="py-3 px-3 w-12 text-center">#</th>
                                        <th className="py-3 px-4">Provider</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Created</th>
                                        <th className="py-3 px-4">Updated</th>
                                        <th className="py-3 px-4">Execution Time</th>
                                        <th className="py-3 px-4">Triggered By</th>
                                        <th className="py-3 px-4">Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                    {logs.map((log, index) => (
                                        <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                                            <td className="py-3 px-3 text-center text-xs font-mono text-neutral-400 dark:text-neutral-500 font-semibold">
                                                {index + 1}
                                            </td>
                                            <td className="py-3 px-4 font-semibold uppercase text-xs">
                                                {log.provider}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge
                                                    className={`text-[10px] uppercase ${
                                                        log.status === 'success'
                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                            : 'bg-red-500/10 text-red-600 border-red-500/20'
                                                    }`}
                                                >
                                                    {log.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 font-mono font-medium">
                                                +{log.ipos_created}
                                            </td>
                                            <td className="py-3 px-4 font-mono font-medium">
                                                {log.ipos_updated}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-xs text-neutral-500">
                                                {log.execution_time_ms} ms
                                            </td>
                                            <td className="py-3 px-4 text-xs text-neutral-600 dark:text-neutral-400">
                                                {log.triggered_by?.name || 'System / CLI'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-neutral-500">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
