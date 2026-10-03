import { Head, Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    Briefcase,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    RefreshCw,
    TrendingUp,
    Users,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import type { ApplicationBatch, BreadcrumbItem, Ipo, IpoRate } from '@/types';

interface AdminMetrics {
    totalUsers: number;
    activeUsers: number;
    totalIpos: number;
    openIpos: number;
    upcomingIpos: number;
    closedIpos: number;
    totalApplications: number;
    myMoneyApps: number;
    userMoneyApps: number;
    capitalDeployedByMe: number;
    userFundedCapital: number;
    expectedGrossProfit: number;
    expectedUserPayouts: number;
    expectedNetEarnings: number;
    realizedGrossProfit: number;
    realizedUserPayouts: number;
    realizedNetEarnings: number;
    pendingSettlementsCount: number;
}

interface DashboardProps {
    metrics: AdminMetrics;
    recentBatches: ApplicationBatch[];
    recentRateChanges: IpoRate[];
    upcomingIpos: Ipo[];
    categorizedIpos?: {
        open: Ipo[];
        upcoming: Ipo[];
        closed: Ipo[];
    };
    chartData: {
        iposWithApps: { name: string; applications: number }[];
        fundingSplit: { name: string; value: number }[];
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Admin Dashboard',
        href: '/dashboard',
    },
];

export default function Dashboard({
    metrics,
    recentBatches,
    recentRateChanges,
    upcomingIpos,
    categorizedIpos,
    chartData,
}: DashboardProps) {
    const [ipoCategoryTab, setIpoCategoryTab] = useState<'open' | 'upcoming' | 'closed'>('open');

    const displayedIpos = categorizedIpos ? (categorizedIpos[ipoCategoryTab] || []) : upcomingIpos;
    const formatInr = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Admin Dashboard — IPO Management" />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                            IPO Portfolio & Profit Overview
                        </h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Track trader rates, friend applications, funding sources, and real-time net earnings.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button asChild variant="outline">
                            <Link href="/sync">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Sync Data
                            </Link>
                        </Button>
                        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Link href="/ipos">
                                <TrendingUp className="mr-2 h-4 w-4" />
                                View All IPOs
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Top Metrics Row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Expected Net Earnings */}
                    <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Expected Net Earnings
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {formatInr(metrics.expectedNetEarnings)}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">
                                Realized so far: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{formatInr(metrics.realizedNetEarnings)}</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Capital Deployed */}
                    <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Capital Deployed (My Money)
                            </CardTitle>
                            <Wallet className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {formatInr(metrics.capitalDeployedByMe)}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">
                                User-funded capital: <span className="font-medium">{formatInr(metrics.userFundedCapital)}</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Total Applications */}
                    <Card className="border-l-4 border-l-purple-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Total Applications
                            </CardTitle>
                            <Briefcase className="h-4 w-4 text-purple-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {metrics.totalApplications}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">
                                {metrics.myMoneyApps} My Money · {metrics.userMoneyApps} User Money
                            </p>
                        </CardContent>
                    </Card>

                    {/* Active IPOs & Friends */}
                    <Card className="border-l-4 border-l-amber-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Active Pipeline
                            </CardTitle>
                            <Users className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {metrics.openIpos} Open
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">
                                {metrics.upcomingIpos} Upcoming · {metrics.activeUsers} Active Friends
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Financial Health Summary Banner */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-900 dark:to-neutral-900/50 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Financial Settlement Health
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                            <span className="text-xs text-neutral-500">Gross Expected Profit</span>
                            <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                                {formatInr(metrics.expectedGrossProfit)}
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-neutral-500">Agreed User Payouts</span>
                            <div className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                                {formatInr(metrics.expectedUserPayouts)}
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-neutral-500">Realized User Payouts</span>
                            <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatInr(metrics.realizedUserPayouts)}
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-neutral-500">Pending Settlements</span>
                            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                                {metrics.pendingSettlementsCount} Batches
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid: Recent Batches & Upcoming IPOs */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Recent Applications (2 cols) */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle className="text-base font-semibold">Recent Application Batches</CardTitle>
                                <CardDescription>Latest submissions with immutable rate snapshots</CardDescription>
                            </div>
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/applications" className="text-xs">
                                    View All <ArrowUpRight className="ml-1 h-3 w-3" />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {recentBatches.length === 0 ? (
                                <p className="py-8 text-center text-sm text-neutral-500">No applications recorded yet.</p>
                            ) : (
                                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                    {recentBatches.map((batch) => (
                                        <div key={batch.id} className="flex items-center justify-between py-3">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                                        {batch.ipo?.company_name}
                                                    </span>
                                                    <Badge variant={batch.funding_source === 'my_money' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                                                        {batch.funding_source === 'my_money' ? 'My Money' : 'User Money'}
                                                    </Badge>
                                                </div>
                                                <span className="text-xs text-neutral-500 mt-0.5">
                                                    {batch.user?.name} · {batch.application_count} {batch.application_count > 1 ? 'apps' : 'app'} @ ₹{batch.published_rate_snapshot}/app (Trader ₹{batch.trader_rate_snapshot})
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                    Margin: ₹{Number(batch.margin_snapshot) * batch.application_count}
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] ${
                                                        batch.settlement_status === 'settled'
                                                            ? 'border-emerald-500 text-emerald-600'
                                                            : 'border-amber-500 text-amber-600'
                                                    }`}
                                                >
                                                    {batch.settlement_status === 'settled' ? 'Settled' : 'Estimated'}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Upcoming, Open & Closed IPOs (1 col) */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">IPO Directory</CardTitle>
                                    <CardDescription>Live categorized IPOs by bidding status</CardDescription>
                                </div>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href="/ipos" className="text-xs">
                                        All ({metrics.totalIpos}) <ArrowUpRight className="ml-1 h-3 w-3" />
                                    </Link>
                                </Button>
                            </div>

                            {/* Category Selector Tabs */}
                            <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800/80 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIpoCategoryTab('open')}
                                    className={`flex-1 rounded-md py-1 px-2 text-xs font-semibold transition-all ${
                                        ipoCategoryTab === 'open'
                                            ? 'bg-white text-emerald-700 shadow-sm dark:bg-neutral-900 dark:text-emerald-400'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    Open ({metrics.openIpos})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIpoCategoryTab('upcoming')}
                                    className={`flex-1 rounded-md py-1 px-2 text-xs font-semibold transition-all ${
                                        ipoCategoryTab === 'upcoming'
                                            ? 'bg-white text-blue-700 shadow-sm dark:bg-neutral-900 dark:text-blue-400'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    Upcoming ({metrics.upcomingIpos})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIpoCategoryTab('closed')}
                                    className={`flex-1 rounded-md py-1 px-2 text-xs font-semibold transition-all ${
                                        ipoCategoryTab === 'closed'
                                            ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-900 dark:text-neutral-200'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    Closed ({metrics.closedIpos})
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {displayedIpos.length === 0 ? (
                                <p className="py-6 text-center text-sm text-neutral-500">
                                    No {ipoCategoryTab} IPOs at this time.
                                </p>
                            ) : (
                                displayedIpos.map((ipo) => (
                                    <div
                                        key={ipo.id}
                                        className="rounded-lg border border-neutral-100 dark:border-neutral-800 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <Link href={`/ipos/${ipo.id}`} className="font-semibold text-neutral-900 dark:text-neutral-100 hover:underline">
                                                    {ipo.company_name}
                                                </Link>
                                                <div className="text-xs text-neutral-500 mt-1 font-mono">
                                                    {ipo.symbol || 'SYMBOL TBD'} · {ipo.ipo_type?.toUpperCase()}
                                                </div>
                                            </div>
                                            <Badge
                                                className={`capitalize text-[10px] font-semibold ${
                                                    ipo.status === 'open'
                                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                        : ipo.status === 'upcoming'
                                                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                                        : 'bg-neutral-500/10 text-neutral-600 border border-neutral-500/20'
                                                }`}
                                            >
                                                {ipo.status}
                                            </Badge>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                            <span className="text-neutral-500">
                                                {ipo.status === 'open'
                                                    ? `Closes ${ipo.close_date}`
                                                    : ipo.status === 'upcoming'
                                                    ? `Opens ${ipo.open_date}`
                                                    : `Ended ${ipo.close_date}`}
                                            </span>
                                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                                {ipo.lot_size} sh · {ipo.price_band_max ? `₹${ipo.price_band_max}` : 'TBD'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
