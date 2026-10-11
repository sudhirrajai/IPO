import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowUpDown,
    Calendar,
    Check,
    ChevronRight,
    Copy,
    Eye,
    Flame,
    LayoutGrid,
    List,
    Lock,
    Plus,
    RefreshCw,
    Search,
    Share2,
    Star,
    TrendingUp,
    X,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
        favorites?: number;
        open: number;
        upcoming: number;
        closed: number;
    };
    filters: {
        status?: string;
        type?: string;
        search?: string;
        sort?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'IPO Listings',
        href: '/ipos',
    },
];

function formatDisplayDate(dateStr?: string | null): string {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(open?: string | null, close?: string | null): string {
    if (!open && !close) return 'Dates TBD';
    if (open && !close) return `From ${formatDisplayDate(open)}`;
    if (!open && close) return `Closes ${formatDisplayDate(close)}`;
    const dOpen = new Date(open!);
    const dClose = new Date(close!);
    if (isNaN(dOpen.getTime()) || isNaN(dClose.getTime())) {
        return `${open} - ${close}`;
    }
    const openDay = dOpen.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const closeStr = dClose.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${openDay} - ${closeStr}`;
}

export default function IposIndex({ ipos, counts, filters }: IposIndexProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const isAdmin = auth.user?.role === 'admin';

    const initialSearch = typeof filters?.search === 'string' ? filters.search : '';
    const [search, setSearch] = useState<string>(initialSearch);
    const [searchCountdown, setSearchCountdown] = useState<number | null>(null);

    // Auto-search 5 seconds after typing stopped
    useEffect(() => {
        const currentAppliedSearch = typeof filters?.search === 'string' ? filters.search : '';
        if (search === currentAppliedSearch) {
            setSearchCountdown(null);
            return;
        }

        setSearchCountdown(5);
        const interval = setInterval(() => {
            setSearchCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
        }, 1000);

        const timer = setTimeout(() => {
            handleFilterChange('search', search);
            setSearchCountdown(null);
        }, 5000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [search, filters?.search]);

    const initialStatus = typeof filters?.status === 'string' ? filters.status : 'all';
    const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

    const initialType = typeof filters?.type === 'string' ? filters.type : 'all';
    const [typeFilter, setTypeFilter] = useState<string>(initialType);

    const initialSort = typeof filters?.sort === 'string' ? filters.sort : 'default';
    const [sortFilter, setSortFilter] = useState<string>(initialSort);

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [copiedIpoId, setCopiedIpoId] = useState<number | null>(null);

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

    const [favoritesMap, setFavoritesMap] = useState<Record<number, boolean>>(() => {
        const map: Record<number, boolean> = {};
        (ipos?.data || []).forEach((item) => {
            map[item.id] = Boolean(item.is_favorite);
        });
        return map;
    });

    const handleToggleFavorite = (e: React.MouseEvent, ipoId: number) => {
        e.preventDefault();
        e.stopPropagation();
        setFavoritesMap((prev) => ({
            ...prev,
            [ipoId]: !prev[ipoId],
        }));
        router.post(`/ipos/${ipoId}/favorite`, {}, {
            preserveScroll: true,
            onError: () => {
                setFavoritesMap((prev) => ({
                    ...prev,
                    [ipoId]: !prev[ipoId],
                }));
            },
        });
    };

    const handleShareIpo = async (e: React.MouseEvent, ipo: Ipo) => {
        e.preventDefault();
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/ipos/${ipo.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${ipo.company_name} (${ipo.ipo_type?.toUpperCase()})`,
                    text: `Check out ${ipo.company_name} Live GMP ₹${ipo.gmp || 0} and IPO details!`,
                    url: shareUrl,
                });
                return;
            } catch {
                // fall back to clipboard copy
            }
        }
        navigator.clipboard.writeText(shareUrl);
        setCopiedIpoId(ipo.id);
        setTimeout(() => setCopiedIpoId(null), 2000);
    };

    const handleFilterChange = (key: string, value: string) => {
        const newFilters: Record<string, string> = {
            search,
            status: key === 'status' ? value : statusFilter,
            type: key === 'type' ? value : typeFilter,
            sort: key === 'sort' ? value : sortFilter,
            [key]: value,
        };

        if (key === 'status') {
            setStatusFilter(value);
        }
        if (key === 'type') {
            setTypeFilter(value);
        }
        if (key === 'sort') {
            setSortFilter(value);
        }

        if (newFilters.status === 'all') delete newFilters.status;
        if (newFilters.type === 'all') delete newFilters.type;
        if (newFilters.sort === 'default') delete newFilters.sort;
        if (!newFilters.search) delete newFilters.search;

        router.get('/ipos', newFilters, { preserveState: true, replace: true });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchCountdown(null);
        handleFilterChange('search', search);
    };

    const clearSearch = () => {
        setSearch('');
        setSearchCountdown(null);
        handleFilterChange('search', '');
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
            <Head title="IPO Listings, Live GMP & Applications" />

            <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                            <span>IPO Market Portal</span>
                            <span className="text-xs font-normal text-neutral-500 font-mono">
                                ({ipos.total} IPOs live)
                            </span>
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                            Real-time Grey Market Premium (GMP), dates, ratings and direct application submission.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && (
                            <>
                                <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                                    <Link href="/sync">
                                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                        Sync & Scraper
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

                {/* Primary Categorization Tabs (Image 2 style: OPEN, UPCOMING, CLOSED) */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-neutral-200 pb-3 dark:border-neutral-800 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'open')}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all ${statusFilter === 'open'
                                ? 'bg-emerald-500 text-neutral-950 shadow-md ring-2 ring-emerald-500/40'
                                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Open</span>
                        <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${statusFilter === 'open'
                                    ? 'bg-neutral-950 text-white'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                }`}
                        >
                            {counts?.open ?? 0}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'upcoming')}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all ${statusFilter === 'upcoming'
                                ? 'bg-amber-500 text-neutral-950 shadow-md ring-2 ring-amber-500/40'
                                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                    >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Upcoming</span>
                        <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${statusFilter === 'upcoming'
                                    ? 'bg-neutral-950 text-white'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                }`}
                        >
                            {counts?.upcoming ?? 0}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'closed')}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all ${statusFilter === 'closed'
                                ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-500/40'
                                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                            }`}
                    >
                        <span>Closed</span>
                        <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${statusFilter === 'closed'
                                    ? 'bg-neutral-950 text-white'
                                    : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                }`}
                        >
                            {counts?.closed ?? 0}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'all')}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-all ${statusFilter === 'all'
                                ? 'bg-neutral-900 text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
                            }`}
                    >
                        <span>All</span>
                        <span
                            className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono font-bold ${statusFilter === 'all'
                                    ? 'bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900'
                                    : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                }`}
                        >
                            {counts?.all ?? ipos.total}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('status', 'favorites')}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-all ${statusFilter === 'favorites'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'
                            }`}
                    >
                        <Star className={`h-3.5 w-3.5 ${statusFilter === 'favorites' ? 'fill-white stroke-white' : 'fill-amber-400 stroke-amber-500'}`} />
                        <span>Favorites</span>
                        <span
                            className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono font-bold ${statusFilter === 'favorites'
                                    ? 'bg-amber-800 text-white'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                }`}
                        >
                            {counts?.favorites ?? 0}
                        </span>
                    </button>
                </div>

                {/* Filter and Search Bar + Chips for Mainboard / SME / Sort */}
                <div className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white p-3 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search IPO company name or symbol..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-16 h-9 text-xs sm:text-sm"
                        />
                        <div className="absolute right-2.5 top-2 flex items-center gap-1.5">
                            {searchCountdown !== null && (
                                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20 animate-pulse">
                                    {searchCountdown}s
                                </span>
                            )}
                            {search && (
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                                    title="Clear search"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap">
                        {/* Market Type Chips: MAINBOARD / SME */}
                        <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => handleFilterChange('type', typeFilter === 'mainboard' ? 'all' : 'mainboard')}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase transition-all ${
                                    typeFilter === 'mainboard'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                                }`}
                            >
                                Mainboard
                            </button>
                            <button
                                type="button"
                                onClick={() => handleFilterChange('type', typeFilter === 'sme' ? 'all' : 'sme')}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase transition-all ${
                                    typeFilter === 'sme'
                                        ? 'bg-purple-600 text-white shadow-xs'
                                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                                }`}
                            >
                                SME
                            </button>
                        </div>

                        {/* Sort Dropdown */}
                        <Select
                            value={sortFilter}
                            onValueChange={(val) => {
                                setSortFilter(val);
                                handleFilterChange('sort', val);
                            }}
                        >
                            <SelectTrigger className="w-[140px] h-9 text-xs">
                                <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-neutral-400" />
                                <SelectValue placeholder="Sort" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default Sort</SelectItem>
                                <SelectItem value="gmp_desc">Highest GMP (₹)</SelectItem>
                                <SelectItem value="date_open">Opening Date</SelectItem>
                                <SelectItem value="date_close">Closing Date</SelectItem>
                                <SelectItem value="allotment">Allotment Date</SelectItem>
                                <SelectItem value="name_asc">Company (A-Z)</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* View Mode Toggle: Cards vs Table */}
                        <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 bg-neutral-50 dark:bg-neutral-900/50">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'grid'
                                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 shadow-xs'
                                        : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                                    }`}
                                title="App Cards View (Image 2 style)"
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline">Cards</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'list'
                                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 shadow-xs'
                                        : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                                    }`}
                                title="Compact Table View"
                            >
                                <List className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline">Table</span>
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
                            Try adjusting your filters or sync with InvestorGain / Upstox.
                        </p>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* CARDS VIEW - MATCHING IMAGE 2 EXACTLY */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {ipos.data.map((ipo) => {
                            const isIpoOpen = ipo.status === 'open';
                            const isIpoUpcoming = ipo.status === 'upcoming';
                            const isFixDisabled = !isAdmin && ipo.accept_fix_applications === false;

                            const priceBandMax = Number(ipo.price_band_max || ipo.issue_price || 0);
                            const priceBandMin = Number(ipo.price_band_min || 0);
                            const gmpVal = ipo.gmp !== null && ipo.gmp !== undefined ? Number(ipo.gmp) : null;
                            const gmpPercent = ipo.gmp_percent !== null && ipo.gmp_percent !== undefined
                                ? Number(ipo.gmp_percent).toFixed(1)
                                : (gmpVal !== null && priceBandMax > 0 ? ((gmpVal / priceBandMax) * 100).toFixed(1) : null);

                            const lotSize = Number(ipo.lot_size || 1);
                            const retailGain = ipo.retail_gain
                                ? Number(ipo.retail_gain)
                                : (gmpVal !== null && lotSize > 0 ? gmpVal * lotSize : null);
                            const hniGain = ipo.hni_gain
                                ? Number(ipo.hni_gain)
                                : (retailGain !== null ? retailGain * 14 : null);

                            const priceText = priceBandMin > 0 && priceBandMax > 0 && priceBandMin !== priceBandMax
                                ? `₹${priceBandMin} - ₹${priceBandMax}`
                                : (priceBandMax > 0 ? `₹${priceBandMax}` : 'TBD');

                            const initials = ipo.company_name
                                .split(' ')
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((w) => w[0]?.toUpperCase())
                                .join('');

                            const isSme = ipo.ipo_type === 'sme';

                            return (
                                <div
                                    key={ipo.id}
                                    className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#121620] p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between relative group hover:border-blue-500/50"
                                >
                                    <div>
                                        {/* Card Header: Company Name & Status Pill (Pre-Apply / Open / Closed / Paused) */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-500 transition-colors">
                                                    {ipo.company_name} ({isSme ? 'SME' : 'MAINBOARD'})
                                                </h3>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {isFixDisabled ? (
                                                    <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                                                        <Lock className="h-3 w-3 mr-1 inline" /> Paused
                                                    </Badge>
                                                ) : isIpoUpcoming ? (
                                                    <Badge className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-extrabold text-[11px] px-2.5 py-0.5 rounded-md shadow-xs">
                                                        Pre-Apply
                                                    </Badge>
                                                ) : isIpoOpen ? (
                                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-extrabold text-[11px] px-2.5 py-0.5 rounded-md shadow-xs animate-pulse">
                                                        Apply Now
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-neutral-500/20 text-neutral-500 dark:text-neutral-400 font-semibold text-[10px] px-2.5 py-0.5 rounded-md">
                                                        Closed
                                                    </Badge>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleToggleFavorite(e, ipo.id)}
                                                    className="p-1 rounded-md text-neutral-300 hover:text-amber-500 dark:text-neutral-600 transition-colors"
                                                    title="Favorite"
                                                >
                                                    <Star className={`h-4 w-4 ${favoritesMap[ipo.id] ? 'fill-amber-400 stroke-amber-500 text-amber-500' : 'stroke-current'}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Avatar & Core Metadata (Date, Price, Lot Size, Issue Size) */}
                                        <div className="flex items-start gap-3.5 mb-3.5">
                                            {/* Stylized Brand Logo / Monogram */}
                                            <div className={`h-14 w-14 rounded-xl flex items-center justify-center font-bold text-base text-white shadow-md shrink-0 ${
                                                isSme
                                                    ? 'bg-linear-to-br from-purple-600 to-indigo-700'
                                                    : 'bg-linear-to-br from-blue-600 via-sky-600 to-cyan-600'
                                            }`}>
                                                {initials || 'IPO'}
                                            </div>

                                            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                                <div>
                                                    <span className="text-neutral-400 text-[11px] block">Date:</span>
                                                    <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate block">
                                                        {formatDateRange(ipo.open_date, ipo.close_date)}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-neutral-400 text-[11px] block">Price:</span>
                                                    <span className="font-semibold text-neutral-800 dark:text-neutral-200 block">
                                                        {priceText}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-neutral-400 text-[11px] block">Lot Size:</span>
                                                    <span className="font-semibold text-neutral-800 dark:text-neutral-200 block">
                                                        {lotSize}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-neutral-400 text-[11px] block">Issue Size:</span>
                                                    <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate block">
                                                        {ipo.issue_size || 'TBD'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* GMP Rumors Spotlight Block (Green font, flames & update time) */}
                                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 sm:p-3 mb-3.5 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                                                    <span>GMP Rumors*:</span>
                                                    {ipo.gmp_rating && ipo.gmp_rating > 0 ? (
                                                        <span title={`${ipo.gmp_rating} star rating`}>
                                                            {'🔥'.repeat(Math.min(ipo.gmp_rating, 5))}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                                                    {gmpVal !== null ? (
                                                        <>
                                                            {gmpVal.toFixed(1)} {gmpPercent ? `(${gmpPercent}%)` : ''}
                                                        </>
                                                    ) : (
                                                        'N/A'
                                                    )}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                                                <span>Last Heard:</span>
                                                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                                                    {ipo.gmp_updated_on || (ipo.last_synced_at ? new Date(ipo.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live Scraper Feed')}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Timelines and Financial Multipliers (Retail & HNI) */}
                                        <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 mb-3 border-t border-neutral-100 dark:border-neutral-800 pt-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-neutral-400">Allotment Date:</span>
                                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                                    {formatDisplayDate(ipo.allotment_date)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-neutral-400">Listing Date:</span>
                                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                                    {formatDisplayDate(ipo.listing_date)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 border-t border-dashed border-neutral-200 dark:border-neutral-800">
                                                <span className="text-neutral-500 dark:text-neutral-400">GMP x Lot (Retail)*:</span>
                                                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                                    {retailGain !== null ? `₹${retailGain.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-neutral-500 dark:text-neutral-400">GMP x Lots (HNI)*:</span>
                                                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                                    {hniGain !== null ? `₹${hniGain.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                                </span>
                                            </div>

                                            {ipo.active_rate && (
                                                <div className="flex items-center justify-between pt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                    <span>Fixed Rate Payout:</span>
                                                    <span className="font-bold">₹{ipo.active_rate.published_rate} / app</span>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[10px] text-neutral-400 italic mb-3">
                                            * Info is indicative, not an investment advice.
                                        </p>
                                    </div>

                                    {/* Footer Actions: VIEW, SHARE, APPLY */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-9 rounded-xl text-xs font-semibold"
                                            >
                                                <Link href={`/ipos/${ipo.id}`} prefetch="hover">
                                                    VIEW
                                                </Link>
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => handleShareIpo(e, ipo)}
                                                className="h-9 w-9 p-0 rounded-xl shrink-0"
                                                title="Share IPO"
                                            >
                                                {copiedIpoId === ipo.id ? (
                                                    <Check className="h-4 w-4 text-emerald-600" />
                                                ) : (
                                                    <Share2 className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                                                )}
                                            </Button>

                                            {isFixDisabled ? (
                                                <Button
                                                    disabled
                                                    size="sm"
                                                    className="flex-1 h-9 rounded-xl text-xs font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-300 dark:border-neutral-700"
                                                >
                                                    <Lock className="mr-1.5 h-3.5 w-3.5" />
                                                    Closed
                                                </Button>
                                            ) : (
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    className="flex-1 h-9 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                                                >
                                                    <Link href={`/ipos/${ipo.id}`}>
                                                        {isIpoUpcoming ? 'PRE-APPLY' : 'APPLY'}
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>

                                        {/* Bottom Market Accent Pill (Mainboard or SME) */}
                                        <div className={`w-full text-center py-1 rounded-lg text-white text-[11px] font-bold tracking-wider uppercase shadow-xs ${
                                            isSme ? 'bg-purple-600' : 'bg-blue-600'
                                        }`}>
                                            {isSme ? 'SME' : 'Mainboard'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* COMPACT TABLE VIEW FOR POWER USERS */
                    <div className="space-y-2.5">
                        {ipos.data.map((ipo) => {
                            const isIpoOpen = ipo.status === 'open';
                            const isIpoUpcoming = ipo.status === 'upcoming';
                            const isFixDisabled = !isAdmin && ipo.accept_fix_applications === false;

                            const priceBandMax = Number(ipo.price_band_max || ipo.issue_price || 0);
                            const gmpVal = ipo.gmp !== null && ipo.gmp !== undefined ? Number(ipo.gmp) : null;
                            const gmpPercent = ipo.gmp_percent !== null && ipo.gmp_percent !== undefined
                                ? Number(ipo.gmp_percent).toFixed(1)
                                : (gmpVal !== null && priceBandMax > 0 ? ((gmpVal / priceBandMax) * 100).toFixed(1) : null);
                            const lotCost = priceBandMax && ipo.lot_size
                                ? (priceBandMax * Number(ipo.lot_size)).toLocaleString('en-IN')
                                : null;

                            return (
                                <Link
                                    key={ipo.id}
                                    href={`/ipos/${ipo.id}`}
                                    prefetch="hover"
                                    className="group block rounded-xl border border-neutral-200/90 bg-white p-3.5 sm:p-4 transition-all hover:border-blue-500/50 hover:shadow-md dark:border-neutral-800/80 dark:bg-neutral-900/80 active:scale-[0.99]"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0 bg-neutral-50 dark:bg-neutral-800/60"
                                                >
                                                    {ipo.ipo_type || 'Mainboard'} · {ipo.exchange || 'NSE/BSE'}
                                                </Badge>

                                                <Badge
                                                    className={`capitalize text-[10px] font-semibold px-2 py-0.2 ${isFixDisabled
                                                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                                                            : isIpoOpen
                                                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                                                                : isIpoUpcoming
                                                                    ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                                                                    : 'bg-neutral-500/10 text-neutral-600 border border-neutral-500/20'
                                                        }`}
                                                >
                                                    {isFixDisabled ? 'Applications Paused' : ipo.status}
                                                </Badge>

                                                {ipo.active_rate && (
                                                    <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-600/20 dark:text-emerald-300 text-[10px] font-semibold">
                                                        ₹{ipo.active_rate.published_rate} / app
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                                    {ipo.company_name}
                                                </h3>
                                                {ipo.gmp_rating && ipo.gmp_rating > 0 ? (
                                                    <span className="text-xs">{'🔥'.repeat(Math.min(ipo.gmp_rating, 5))}</span>
                                                ) : null}
                                            </div>

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

                                        <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800/80">
                                            <div className="text-left sm:text-right">
                                                <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                                                    GMP Premium
                                                </span>
                                                <div className="flex items-baseline gap-1 sm:justify-end">
                                                    <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                        {gmpVal !== null ? `₹${gmpVal}` : 'N/A'}
                                                    </span>
                                                    {gmpPercent && (
                                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-1 rounded">
                                                            +{gmpPercent}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-semibold text-neutral-400 block">
                                                    {isIpoOpen ? 'Closes' : isIpoUpcoming ? 'Opens' : 'Allotment'}
                                                </span>
                                                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                                    {isIpoOpen
                                                        ? ipo.close_date || 'Closing Soon'
                                                        : isIpoUpcoming
                                                            ? ipo.open_date || 'Opening Soon'
                                                            : ipo.allotment_date || 'Closed'}
                                                </span>
                                            </div>

                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 group-hover:bg-blue-600 group-hover:text-white dark:bg-neutral-800 dark:group-hover:bg-blue-600 transition-colors">
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
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
                                <Label htmlFor="price_band_min">Price Min</Label>
                                <Input
                                    id="price_band_min"
                                    type="number"
                                    step="0.01"
                                    value={formData.price_band_min}
                                    onChange={(e) => setFormData({ ...formData, price_band_min: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="price_band_max">Price Max</Label>
                                <Input
                                    id="price_band_max"
                                    type="number"
                                    step="0.01"
                                    value={formData.price_band_max}
                                    onChange={(e) => setFormData({ ...formData, price_band_max: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="lot_size">Lot Size</Label>
                                <Input
                                    id="lot_size"
                                    type="number"
                                    value={formData.lot_size}
                                    onChange={(e) => setFormData({ ...formData, lot_size: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="issue_size">Issue Size</Label>
                                <Input
                                    id="issue_size"
                                    placeholder="e.g. ₹712.31 Cr"
                                    value={formData.issue_size}
                                    onChange={(e) => setFormData({ ...formData, issue_size: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="gmp">Initial GMP (₹)</Label>
                                <Input
                                    id="gmp"
                                    type="number"
                                    step="0.01"
                                    value={formData.gmp}
                                    onChange={(e) => setFormData({ ...formData, gmp: e.target.value })}
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
