import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Calendar,
    ChevronRight,
    Coins,
    LayoutGrid,
    List,
    Plus,
    RefreshCw,
    Search,
    TrendingUp,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import type { BreadcrumbItem, Ipo, User } from '@/types';

interface IposIndexProps {
    ipos: {
        data: Ipo[];
        current_page: number;
        last_page: number;
        total: number;
    };
    counts?: {
        all: number;
        open: number;
        upcoming: number;
        closed: number;
    };
    filters: {
        status?: string;
        type?: string;
        search?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'IPO Listings',
        href: '/ipos',
    },
];

export default function IposIndex({ ipos, counts, filters }: IposIndexProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const isAdmin = auth.user?.role === 'admin';

    const [search, setSearch] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [typeFilter, setTypeFilter] = useState(filters.type || 'all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Create IPO form state
    const [formData, setFormData] = useState({
        company_name: '',
        symbol: '',
        exchange: 'NSE/BSE',
        ipo_type: 'mainboard',
        category: 'Mainboard',
        open_date: '',
        close_date: '',
        allotment_date: '',
        listing_date: '',
        price_band_min: '',
        price_band_max: '',
        issue_price: '',
        lot_size: '1',
        issue_size: '',
        gmp: '',
        status: 'open',
    });

    const handleFilterChange = (key: string, value: string) => {
        const newFilters: Record<string, string> = {
            search,
            status: key === 'status' ? value : statusFilter,
            type: key === 'type' ? value : typeFilter,
            [key]: value,
        };

        if (key === 'status') {
            setStatusFilter(value);
        }
        if (key === 'type') {
            setTypeFilter(value);
        }

        if (newFilters.status === 'all') delete newFilters.status;
        if (newFilters.type === 'all') delete newFilters.type;
        if (!newFilters.search) delete newFilters.search;

        router.get('/ipos', newFilters, { preserveState: true, replace: true });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange('search', search);
    };

    const handleCreateIpo = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/ipos', formData, {
            onSuccess: () => {
                setIsCreateOpen(false);
                setFormData({
                    company_name: '',
                    symbol: '',
                    exchange: 'NSE/BSE',
                    ipo_type: 'mainboard',
                    category: 'Mainboard',
                    open_date: '',
                    close_date: '',
                    allotment_date: '',
                    listing_date: '',
                    price_band_min: '',
                    price_band_max: '',
                    issue_price: '',
                    lot_size: '1',
                    issue_size: '',
                    gmp: '',
                    status: 'open',
                });
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="IPO Listings & Rates" />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                            <span>IPO Listings</span>
                            <span className="text-xs font-normal text-neutral-500 font-mono">
                                ({ipos.total} total)
                            </span>
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                            Track live grey market premium (GMP), dates, rates and applications.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && (
                            <>
                                <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                                    <Link href="/sync">
                                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                        Sync API
                                    </Link>
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setIsCreateOpen(true)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-semibold"
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add IPO
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Primary Categorization Tabs (Mobile Swipeable) */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-neutral-200 pb-3 dark:border-neutral-800 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'all')}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                            statusFilter === 'all'
                                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'
                        }`}
                    >
                        <span>All IPOs</span>
                        <span
                            className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono font-bold ${
                                statusFilter === 'all'
                                    ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900'
                                    : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                            }`}
                        >
                            {counts?.all ?? ipos.total}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'open')}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                            statusFilter === 'open'
                                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                                : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                        }`}
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Open for Bidding</span>
                        <span
                            className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono font-bold ${
                                statusFilter === 'open'
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            }`}
                        >
                            {counts?.open ?? 0}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'upcoming')}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                            statusFilter === 'upcoming'
                                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                                : 'text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                        }`}
                    >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Upcoming</span>
                        <span
                            className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono font-bold ${
                                statusFilter === 'upcoming'
                                    ? 'bg-blue-700 text-white'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                            }`}
                        >
                            {counts?.upcoming ?? 0}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'closed')}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                            statusFilter === 'closed'
                                ? 'bg-neutral-600 text-white shadow-sm ring-2 ring-neutral-600/30'
                                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                        }`}
                    >
                        <span>Closed</span>
                        <span
                            className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono font-bold ${
                                statusFilter === 'closed'
                                    ? 'bg-neutral-700 text-white'
                                    : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                            }`}
                        >
                            {counts?.closed ?? 0}
                        </span>
                    </button>
                </div>

                {/* Filter and Search Bar + View Toggle */}
                <div className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white p-3 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search IPO company or symbol..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9 text-xs sm:text-sm"
                        />
                    </form>

                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                        <Select
                            value={typeFilter}
                            onValueChange={(val) => {
                                setTypeFilter(val);
                                handleFilterChange('type', val);
                            }}
                        >
                            <SelectTrigger className="w-[140px] h-9 text-xs">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Markets</SelectItem>
                                <SelectItem value="mainboard">Mainboard</SelectItem>
                                <SelectItem value="sme">SME</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* View Mode Toggle: List vs Grid */}
                        <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 bg-neutral-50 dark:bg-neutral-900/50">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'list'
                                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 shadow-xs'
                                        : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                                }`}
                                title="Compact List View"
                                aria-label="Compact List View"
                            >
                                <List className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline">List</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'grid'
                                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 shadow-xs'
                                        : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                                }`}
                                title="Grid Cards View"
                                aria-label="Grid Cards View"
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline">Grid</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* IPOs Display */}
                {ipos.data.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/30">
                        <TrendingUp className="mx-auto h-9 w-9 text-neutral-400" />
                        <h3 className="mt-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">No IPOs found</h3>
                        <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
                            Try adjusting your filters or sync with an external IPO provider.
                        </p>
                    </div>
                ) : viewMode === 'list' ? (
                    /* COMPACT LIST VIEW - Mobile First & Tap Friendly */
                    <div className="space-y-2.5">
                        {ipos.data.map((ipo) => {
                            const isIpoOpen = ipo.status === 'open';
                            const isIpoUpcoming = ipo.status === 'upcoming';
                            const priceBandMax = Number(ipo.price_band_max || ipo.issue_price || 0);
                            const gmpVal = ipo.gmp !== null && ipo.gmp !== undefined ? Number(ipo.gmp) : null;
                            const gmpPercent = gmpVal !== null && priceBandMax > 0
                                ? ((gmpVal / priceBandMax) * 100).toFixed(1)
                                : null;
                            const lotCost = priceBandMax && ipo.lot_size
                                ? (priceBandMax * Number(ipo.lot_size)).toLocaleString('en-IN')
                                : null;

                            return (
                                <Link
                                    key={ipo.id}
                                    href={`/ipos/${ipo.id}`}
                                    prefetch="hover"
                                    className="group block rounded-xl border border-neutral-200/90 bg-white p-3.5 sm:p-4 transition-all hover:border-emerald-500/50 hover:shadow-md dark:border-neutral-800/80 dark:bg-neutral-900/80 dark:hover:border-emerald-500/40 active:scale-[0.99]"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        {/* Left: Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0 bg-neutral-50 dark:bg-neutral-800/60"
                                                >
                                                    {ipo.ipo_type || 'Mainboard'} · {ipo.exchange || 'NSE/BSE'}
                                                </Badge>

                                                <Badge
                                                    className={`capitalize text-[10px] font-semibold px-2 py-0.2 ${
                                                        isIpoOpen
                                                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                                            : isIpoUpcoming
                                                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                                                            : 'bg-neutral-500/10 text-neutral-600 border border-neutral-500/20'
                                                    }`}
                                                >
                                                    {isIpoOpen && (
                                                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    )}
                                                    {ipo.status}
                                                </Badge>

                                                {ipo.active_rate && (
                                                    <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-600/20 dark:text-emerald-300 text-[10px] font-semibold">
                                                        ₹{ipo.active_rate.published_rate} / app
                                                    </Badge>
                                                )}
                                            </div>

                                            <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-50 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                                {ipo.company_name}
                                            </h3>

                                            <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                                                <span className="font-mono text-[11px] text-neutral-400">
                                                    {ipo.symbol || 'SYMBOL TBD'}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    Price: <strong className="text-neutral-800 dark:text-neutral-200">
                                                        {ipo.price_band_min && ipo.price_band_max
                                                            ? `₹${ipo.price_band_min} - ₹${ipo.price_band_max}`
                                                            : ipo.issue_price
                                                            ? `₹${ipo.issue_price}`
                                                            : 'TBD'}
                                                    </strong>
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    Lot: <strong className="text-neutral-800 dark:text-neutral-200">{ipo.lot_size} sh</strong>
                                                    {lotCost && ` (₹${lotCost})`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Right: GMP, Dates & Action Arrow */}
                                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800/80">
                                            {/* GMP Tag */}
                                            <div className="text-left sm:text-right">
                                                <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                                                    GMP Premium
                                                </span>
                                                <div className="flex items-baseline gap-1 sm:justify-end">
                                                    <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                                                        {gmpVal !== null ? `+₹${gmpVal}` : 'N/A'}
                                                    </span>
                                                    {gmpPercent && (
                                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-1 rounded">
                                                            +{gmpPercent}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Dates */}
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                                                    {isIpoOpen ? 'Bidding Closes' : isIpoUpcoming ? 'Bidding Opens' : 'Allotment'}
                                                </span>
                                                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                                    {isIpoOpen
                                                        ? ipo.close_date || 'Closing Soon'
                                                        : isIpoUpcoming
                                                        ? ipo.open_date || 'Opening Soon'
                                                        : ipo.allotment_date || 'Closed'}
                                                </span>
                                            </div>

                                            {/* Chevron Arrow */}
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 group-hover:bg-emerald-600 group-hover:text-white dark:bg-neutral-800 dark:group-hover:bg-emerald-600 transition-colors">
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    /* GRID CARDS VIEW */
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {ipos.data.map((ipo) => {
                            const isIpoOpen = ipo.status === 'open';
                            const isIpoUpcoming = ipo.status === 'upcoming';
                            const lotCost = ipo.price_band_max && ipo.lot_size
                                ? (Number(ipo.price_band_max) * Number(ipo.lot_size)).toLocaleString('en-IN')
                                : null;

                            return (
                                <Card key={ipo.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <Badge variant="outline" className="mb-2 text-[10px] uppercase font-mono font-bold tracking-wider">
                                                    {ipo.ipo_type} · {ipo.exchange}
                                                </Badge>
                                                <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-50 line-clamp-1">
                                                    <Link href={`/ipos/${ipo.id}`} prefetch="hover" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                                        {ipo.company_name}
                                                    </Link>
                                                </h3>
                                                <span className="text-xs text-neutral-500 font-mono">
                                                    {ipo.symbol || 'SYMBOL TBD'}
                                                </span>
                                            </div>
                                            <Badge
                                                className={`capitalize text-xs font-semibold px-2.5 py-1 ${
                                                    isIpoOpen
                                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                                        : isIpoUpcoming
                                                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                                                        : 'bg-neutral-500/10 text-neutral-600 border border-neutral-500/20'
                                                }`}
                                            >
                                                {isIpoOpen && (
                                                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                )}
                                                {isIpoUpcoming && (
                                                    <Calendar className="mr-1.5 inline-block h-3 w-3" />
                                                )}
                                                {ipo.status}
                                            </Badge>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-3 pb-3 text-sm">
                                        <div className="grid grid-cols-2 gap-2 text-xs rounded-md bg-neutral-50 dark:bg-neutral-900/50 p-2.5">
                                            <div>
                                                <span className="text-neutral-500 block">Price Band</span>
                                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                                    {ipo.price_band_min && ipo.price_band_max
                                                        ? `₹${ipo.price_band_min} - ₹${ipo.price_band_max}`
                                                        : ipo.issue_price
                                                        ? `₹${ipo.issue_price}`
                                                        : 'TBD'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-neutral-500 block">Lot Size & Investment</span>
                                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                                    {ipo.lot_size} shares {lotCost ? `(₹${lotCost})` : ''}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-neutral-500 block">Bidding Window</span>
                                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                                    {ipo.open_date ? `${ipo.open_date} to ${ipo.close_date}` : 'Dates TBD'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-neutral-500 block">Timeline Info</span>
                                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                                    {isIpoOpen ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                            Closes {ipo.close_date}
                                                        </span>
                                                    ) : isIpoUpcoming ? (
                                                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                                            Opens {ipo.open_date}
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-500">
                                                            {ipo.allotment_date ? `Allotted ${ipo.allotment_date}` : 'Closed'}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Rates Section */}
                                        <div className="flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800">
                                            <div>
                                                <span className="text-[11px] text-neutral-500 block">Offered User Rate</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    {ipo.active_rate ? `₹${ipo.active_rate.published_rate} / app` : 'Not configured'}
                                                </span>
                                            </div>
                                            {isAdmin && ipo.active_rate && (
                                                <div className="text-right">
                                                    <span className="text-[11px] text-neutral-500 block">Trader Rate</span>
                                                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                                                        ₹{ipo.active_rate.trader_rate} (Margin ₹{ipo.active_rate.margin})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>

                                    <CardFooter className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                        <Button asChild className="w-full" variant="outline">
                                            <Link href={`/ipos/${ipo.id}`} prefetch="hover">
                                                Open Workspace <ChevronRight className="ml-1 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Manual IPO Create Modal (Admin) */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add IPO Manually</DialogTitle>
                        <DialogDescription>
                            Create a custom IPO entry if not available via provider sync.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateIpo} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="company_name">Company Name *</Label>
                            <Input
                                id="company_name"
                                required
                                value={formData.company_name}
                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="symbol">Symbol</Label>
                                <Input
                                    id="symbol"
                                    value={formData.symbol}
                                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ipo_type">Classification</Label>
                                <Select
                                    value={formData.ipo_type}
                                    onValueChange={(val) => setFormData({ ...formData, ipo_type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mainboard">Mainboard</SelectItem>
                                        <SelectItem value="sme">SME</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="open_date">Open Date</Label>
                                <Input
                                    id="open_date"
                                    type="date"
                                    value={formData.open_date}
                                    onChange={(e) => setFormData({ ...formData, open_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="close_date">Close Date</Label>
                                <Input
                                    id="close_date"
                                    type="date"
                                    value={formData.close_date}
                                    onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="price_band_min">Min Price (₹)</Label>
                                <Input
                                    id="price_band_min"
                                    type="number"
                                    value={formData.price_band_min}
                                    onChange={(e) => setFormData({ ...formData, price_band_min: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="price_band_max">Max Price (₹)</Label>
                                <Input
                                    id="price_band_max"
                                    type="number"
                                    value={formData.price_band_max}
                                    onChange={(e) => setFormData({ ...formData, price_band_max: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="lot_size">Lot Size *</Label>
                                <Input
                                    id="lot_size"
                                    type="number"
                                    required
                                    value={formData.lot_size}
                                    onChange={(e) => setFormData({ ...formData, lot_size: e.target.value })}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Save IPO
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
