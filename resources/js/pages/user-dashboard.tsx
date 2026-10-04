import { Head, Link } from '@inertiajs/react';
import {
    Briefcase,
    Calendar,
    CheckCircle2,
    CreditCard,
    DollarSign,
    Star,
    TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import type { ApplicationBatch, BreadcrumbItem, Ipo } from '@/types';
import { useState } from 'react';

interface UserDashboardProps {
    metrics: {
        applicationCount: number;
        savedPanCount: number;
        expectedPayout: number;
        settledPayout: number;
    };
    recentBatches: ApplicationBatch[];
    openIpos: Ipo[];
    categorizedIpos?: {
        favorites?: Ipo[];
        open: Ipo[];
        upcoming: Ipo[];
        closed: Ipo[];
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

export default function UserDashboard({
    metrics,
    recentBatches,
    openIpos,
    categorizedIpos,
}: UserDashboardProps) {
    const [userIpoTab, setUserIpoTab] = useState<'favorites' | 'open' | 'upcoming' | 'closed'>(
        categorizedIpos?.favorites && categorizedIpos.favorites.length > 0 ? 'favorites' : 'open'
    );


    const displayedIpos = categorizedIpos ? (categorizedIpos[userIpoTab] || []) : openIpos;
    const formatInr = (amount: number | string | null | undefined) => {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(val);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My IPO Dashboard" />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                            Welcome to Your IPO Portal
                        </h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            View active IPO rates, track your applications, and review your payouts.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button asChild variant="outline">
                            <Link href="/pans">
                                <CreditCard className="mr-2 h-4 w-4" />
                                Manage Saved PANs
                            </Link>
                        </Button>
                        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Link href="/ipos">
                                <TrendingUp className="mr-2 h-4 w-4" />
                                Apply for IPOs
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Total Payout Expected
                            </CardTitle>
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {formatInr(metrics.expectedPayout)}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">
                                Already settled: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatInr(metrics.settledPayout)}</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Applications Submitted
                            </CardTitle>
                            <Briefcase className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {metrics.applicationCount}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">Across all registered IPOs</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Saved PAN Records
                            </CardTitle>
                            <CreditCard className="h-4 w-4 text-purple-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {metrics.savedPanCount}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">Ready for rapid submission</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-amber-500 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                Open for Bidding
                            </CardTitle>
                            <Calendar className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {openIpos.filter((i) => i.status === 'open').length}
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">Accepting applications right now</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main section: Current IPOs and My Applications */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Available IPOs */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Available IPOs & Rates</CardTitle>
                                    <CardDescription>Live published rates and bidding windows</CardDescription>
                                </div>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href="/ipos" className="text-xs">
                                        View All
                                    </Link>
                                </Button>
                            </div>

                            {/* Category Selector Tabs */}
                            <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800/80 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setUserIpoTab('favorites')}
                                    className={`flex-1 rounded-md py-1 px-1.5 text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                                        userIpoTab === 'favorites'
                                            ? 'bg-white text-amber-700 shadow-sm dark:bg-neutral-900 dark:text-amber-400'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    <Star className={`h-3 w-3 ${userIpoTab === 'favorites' ? 'fill-amber-400 stroke-amber-500' : ''}`} />
                                    <span>Favs ({categorizedIpos?.favorites?.length ?? 0})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUserIpoTab('open')}
                                    className={`flex-1 rounded-md py-1 px-1.5 text-xs font-semibold transition-all ${
                                        userIpoTab === 'open'
                                            ? 'bg-white text-emerald-700 shadow-sm dark:bg-neutral-900 dark:text-emerald-400'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    Open ({categorizedIpos?.open?.length ?? openIpos.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUserIpoTab('upcoming')}
                                    className={`flex-1 rounded-md py-1 px-1.5 text-xs font-semibold transition-all ${
                                        userIpoTab === 'upcoming'
                                            ? 'bg-white text-blue-700 shadow-sm dark:bg-neutral-900 dark:text-blue-400'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    Upcoming ({categorizedIpos?.upcoming?.length ?? 0})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUserIpoTab('closed')}
                                    className={`flex-1 rounded-md py-1 px-1.5 text-xs font-semibold transition-all ${
                                        userIpoTab === 'closed'
                                            ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-900 dark:text-neutral-200'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    Closed ({categorizedIpos?.closed?.length ?? 0})
                                </button>
                            </div>

                        </CardHeader>
                        <CardContent className="space-y-3">
                            {displayedIpos.length === 0 ? (
                                <p className="py-6 text-center text-sm text-neutral-500">
                                    No {userIpoTab} IPOs at this moment.
                                </p>
                            ) : (
                                displayedIpos.map((ipo) => (
                                    <div
                                        key={ipo.id}
                                        className="flex items-center justify-between rounded-lg border border-neutral-100 dark:border-neutral-800 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                                    >
                                        <div>
                                            <Link href={`/ipos/${ipo.id}`} className="font-semibold text-neutral-900 dark:text-neutral-100 hover:underline">
                                                {ipo.company_name}
                                            </Link>
                                            <div className="text-xs text-neutral-500 mt-0.5">
                                                {ipo.status === 'open'
                                                    ? `Closes: ${ipo.close_date || 'TBD'}`
                                                    : ipo.status === 'upcoming'
                                                    ? `Opens: ${ipo.open_date || 'TBD'}`
                                                    : `Ended: ${ipo.close_date || 'TBD'}`} · Lot: {ipo.lot_size}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                {ipo.active_rate ? `₹${ipo.active_rate.published_rate}/app` : 'Rate pending'}
                                            </div>
                                            <Badge
                                                className={`text-[10px] capitalize font-semibold ${
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
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* My Recent Applications */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">My Recent Applications</CardTitle>
                            <CardDescription>Status and expected payouts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {recentBatches.length === 0 ? (
                                <div className="py-8 text-center">
                                    <p className="text-sm text-neutral-500">You haven't submitted any applications yet.</p>
                                    <Button asChild size="sm" className="mt-3">
                                        <Link href="/ipos">Browse Open IPOs</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                    {recentBatches.map((batch) => (
                                        <div key={batch.id} className="flex items-center justify-between py-3">
                                            <div>
                                                <div className="font-medium text-neutral-900 dark:text-neutral-100">
                                                    {batch.ipo?.company_name}
                                                </div>
                                                <div className="text-xs text-neutral-500 mt-0.5">
                                                    {batch.application_count} {batch.application_count > 1 ? 'apps' : 'app'} @ ₹{batch.published_rate_snapshot} · {batch.funding_source === 'my_money' ? 'Funded by Admin' : 'Self Funded'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                    Payout: {formatInr(batch.expected_user_payout)}
                                                </div>
                                                <Badge variant="secondary" className="text-[10px] capitalize">
                                                    {batch.settlement_status === 'settled' ? 'Settled' : batch.application_status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
