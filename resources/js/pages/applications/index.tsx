import { Head, Link, router } from '@inertiajs/react';
import {
    Ban,
    Check,
    CheckCheck,
    CheckCircle2,
    ChevronDown,
    Copy,
    Edit3,
    FileSpreadsheet,
    FileText,
    Filter,
    Landmark,
    Plus,
    Search,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Trash2,
    TrendingUp,
    X,
} from 'lucide-react';
import { useState } from 'react';
import KfintechAllotmentModal, { type AllotmentResultData } from '@/components/kfintech-allotment-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatIstDate, formatIstDateTime, getIstToday } from '@/lib/utils';
import type { ApplicationBatch, BreadcrumbItem, Ipo, User, UserPan } from '@/types';

interface ApplicationsIndexProps {
    batches: {
        data: ApplicationBatch[];
        current_page: number;
        last_page: number;
        total: number;
    };
    ipos: Ipo[];
    users: User[];
    userPans?: UserPan[];
    allotmentTodayCount?: number;
    filters: {
        ipo_id?: string;
        user_id?: string;
        funding_source?: string;
        application_status?: string;
        settlement_status?: string;
        search?: string;
        allotment_today?: string;
    };
    isAdmin: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Applications',
        href: '/applications',
    },
];

export default function ApplicationsIndex({
    batches,
    ipos,
    users,
    userPans = [],
    allotmentTodayCount = 0,
    filters,
    isAdmin,
}: ApplicationsIndexProps) {
    const [selectedIpo, setSelectedIpo] = useState(filters.ipo_id || 'all');
    const [selectedUser, setSelectedUser] = useState(filters.user_id || 'all');
    const [selectedFunding, setSelectedFunding] = useState(filters.funding_source || 'all');
    const [selectedStatus, setSelectedStatus] = useState(filters.application_status || 'all');
    const [selectedSettlement, setSelectedSettlement] = useState(filters.settlement_status || 'all');
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const isAllotmentTodayFilter = filters.allotment_today === '1';

    // Cancel modal
    const [cancellingBatch, setCancellingBatch] = useState<ApplicationBatch | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    // Delete modal
    const [deletingBatch, setDeletingBatch] = useState<ApplicationBatch | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // KFintech Allotment modal
    const [allotmentModalOpen, setAllotmentModalOpen] = useState(false);
    const [allotmentLoading, setAllotmentLoading] = useState(false);
    const [allotmentResult, setAllotmentResult] = useState<AllotmentResultData | null>(null);
    const [allotmentBatch, setAllotmentBatch] = useState<ApplicationBatch | null>(null);
    const [checkedBatchIds, setCheckedBatchIds] = useState<Record<number, { allotted: boolean; details: any }>>({});

    // PAN attach / update modal
    const [panModalBatch, setPanModalBatch] = useState<ApplicationBatch | null>(null);
    const [panModalPanId, setPanModalPanId] = useState<string>('');
    const [panModalPanNumber, setPanModalPanNumber] = useState<string>('');
    const [panModalApplicantName, setPanModalApplicantName] = useState<string>('');
    const [panModalIsNewPan, setPanModalIsNewPan] = useState(false);
    const [panModalSearchQuery, setPanModalSearchQuery] = useState('');
    const [panModalDropdownOpen, setPanModalDropdownOpen] = useState(false);
    const [isSavingPan, setIsSavingPan] = useState(false);

    // PAN copy indicator
    const [copiedPan, setCopiedPan] = useState<string | null>(null);

    // Today date check in Indian Standard Time (Asia/Kolkata)
    const todayIst = getIstToday();
    const todayAllotmentIpos = ipos.filter((ipo) => ipo.allotment_date?.split('T')[0] === todayIst);

    const copyPan = (pan: string) => {
        navigator.clipboard.writeText(pan);
        setCopiedPan(pan);
        setTimeout(() => setCopiedPan(null), 2000);
    };

    const handleFilterChange = (key: string, value: string) => {
        const query: Record<string, string> = {
            ipo_id: selectedIpo,
            user_id: selectedUser,
            funding_source: selectedFunding,
            application_status: selectedStatus,
            settlement_status: selectedSettlement,
            search: searchInput,
            allotment_today: isAllotmentTodayFilter ? '1' : '',
            [key]: value,
        };

        Object.keys(query).forEach((k) => {
            if (query[k] === 'all' || !query[k]) delete query[k];
        });

        router.get('/applications', query, { preserveState: true, replace: true });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange('search', searchInput);
    };

    const clearSearch = () => {
        setSearchInput('');
        handleFilterChange('search', '');
    };

    const toggleAllotmentTodayFilter = () => {
        handleFilterChange('allotment_today', isAllotmentTodayFilter ? 'all' : '1');
    };

    const handleCheckAllotment = async (batch: ApplicationBatch) => {
        setAllotmentBatch(batch);
        setAllotmentLoading(true);
        setAllotmentModalOpen(true);
        setAllotmentResult(null);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const response = await fetch(`/applications/${batch.id}/check-allotment`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                },
            });

            if (response.status === 404) {
                setAllotmentResult({
                    success: false,
                    message: `Application #${batch.batch_number || batch.id} was not found on the server. Please reload the page to refresh records.`,
                });
                return;
            }

            const data = await response.json().catch(() => null);
            if (!data) {
                setAllotmentResult({
                    success: false,
                    message: `Server returned error (${response.status}). Please try again.`,
                });
                return;
            }

            setAllotmentResult({
                ...data,
                pan_full: batch.pan_number || batch.batch_pans?.[0]?.pan_number_snapshot,
                pan_masked: data.pan_masked || (batch.pan_number ? `XXXXXX${batch.pan_number.slice(-4)}` : undefined),
            });

            if (data.success && data.found) {
                setCheckedBatchIds(prev => ({
                    ...prev,
                    [batch.id]: {
                        allotted: Boolean(data.allotted),
                        details: data,
                    },
                }));
            }

            router.reload({ preserveScroll: true });
        } catch (err: any) {
            setAllotmentResult({
                success: false,
                message: err?.message || 'Failed to query KFintech allotment registry.',
            });
        } finally {
            setAllotmentLoading(false);
        }
    };

    const handleDeleteSubmit = () => {
        if (!deletingBatch) return;
        setIsDeleting(true);
        router.delete(`/applications/${deletingBatch.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setDeletingBatch(null);
                setIsDeleting(false);
            },
            onError: () => setIsDeleting(false),
        });
    };

    const handleApprove = (batchId: number) => {
        router.post(`/applications/${batchId}/approve`, {}, { preserveScroll: true });
    };

    const handleReject = (batchId: number) => {
        router.post(`/applications/${batchId}/reject`, {}, { preserveScroll: true });
    };

    // Open PAN modal for a batch
    const openPanModal = (batch: ApplicationBatch) => {
        setPanModalBatch(batch);
        const existingPan = batch.pan_number || batch.batch_pans?.[0]?.pan_number_snapshot || '';
        setPanModalPanNumber(existingPan);
        setPanModalApplicantName(batch.applicant_name || '');
        setPanModalSearchQuery('');
        setPanModalDropdownOpen(false);

        const matched = userPans.find((p) => p.pan_number === existingPan);
        if (matched) {
            setPanModalPanId(String(matched.id));
            setPanModalIsNewPan(false);
        } else if (existingPan) {
            setPanModalPanId('');
            setPanModalIsNewPan(true);
        } else {
            setPanModalPanId('');
            setPanModalIsNewPan(userPans.length === 0);
        }
    };

    const handleSelectModalSavedPan = (p: UserPan) => {
        setPanModalPanId(String(p.id));
        setPanModalPanNumber(p.pan_number);
        if (p.account_holder_name && !panModalApplicantName) {
            setPanModalApplicantName(p.account_holder_name);
        }
        setPanModalDropdownOpen(false);
    };

    const handlePanModalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!panModalBatch) return;
        setIsSavingPan(true);
        router.post(`/applications/${panModalBatch.id}/pan`, {
            pan_id: panModalPanId ? Number(panModalPanId) : null,
            pan_number: panModalPanNumber.toUpperCase().trim(),
            applicant_name: panModalApplicantName.trim(),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setPanModalBatch(null);
                setIsSavingPan(false);
            },
            onError: () => setIsSavingPan(false),
        });
    };

    const filteredSavedPans = userPans.filter((p) => {
        if (!panModalSearchQuery.trim()) return true;
        const q = panModalSearchQuery.toLowerCase();
        return (
            p.pan_number.toLowerCase().includes(q) ||
            (p.account_holder_name && p.account_holder_name.toLowerCase().includes(q)) ||
            (p.broker_name && p.broker_name.toLowerCase().includes(q)) ||
            (p.user?.name && p.user.name.toLowerCase().includes(q))
        );
    });

    const formatInr = (amount: number | string | null | undefined) => {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(val);
    };

    const getUpiAppBadgeClass = (app?: string | null) => {
        switch (app) {
            case 'Google Pay':
                return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
            case 'PhonePe':
                return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
            case 'Paytm':
                return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
            case 'BHIM':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
            case 'Cred':
                return 'bg-neutral-900 text-neutral-100 border-neutral-700 dark:bg-neutral-100 dark:text-neutral-900';
            case 'Amazon Pay':
                return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
            default:
                return 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300';
        }
    };

    const handleStatusChange = (batchId: number, status: 'allotted' | 'not_allotted') => {
        router.post(`/applications/${batchId}/status`, {
            application_status: status,
        }, {
            preserveScroll: true,
        });
    };

    const handleCancelSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!cancellingBatch) return;

        router.post(`/applications/${cancellingBatch.id}/cancel`, {
            reason: cancelReason,
        }, {
            onSuccess: () => {
                setCancellingBatch(null);
                setCancelReason('');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Applications & Batches" />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                            {isAdmin ? 'All Application Batches' : 'My Applications'}
                            {allotmentTodayCount > 0 && (
                                <Badge className="bg-amber-500 text-white font-bold text-xs tracking-wide">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    {allotmentTodayCount} Allotment Today
                                </Badge>
                            )}
                        </h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Historical records, saved PANs, and live allotment status for each application submission.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Link href="/ipos">
                                <Plus className="mr-2 h-4 w-4" />
                                Apply in Active IPO
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Allotment Day Notification Banner */}
                {(todayAllotmentIpos.length > 0 || allotmentTodayCount > 0) && (
                    <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-amber-950/40">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                        Today is Allotment Day!
                                        <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                                            {allotmentTodayCount} Applications
                                        </Badge>
                                    </h3>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                        Scheduled registrar allotment today for:{' '}
                                        <strong className="font-semibold">
                                            {todayAllotmentIpos.map((i) => i.company_name).join(', ') || 'Active IPOs'}
                                        </strong>
                                        . Check live allotment status against the KFintech portal.
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant={isAllotmentTodayFilter ? 'default' : 'outline'}
                                className={
                                    isAllotmentTodayFilter
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm'
                                        : 'border-amber-400 text-amber-900 dark:text-amber-200 bg-white/80 dark:bg-neutral-900/80 hover:bg-amber-100 text-xs font-semibold'
                                }
                                onClick={toggleAllotmentTodayFilter}
                            >
                                <Filter className="h-3.5 w-3.5 mr-1" />
                                {isAllotmentTodayFilter ? 'Show All Applications' : "Filter Today's Allotments"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Filters & Search Toolbar */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    {/* Search Input (PAN, Applicant, Batch, Bank, UPI) */}
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search by PAN, applicant, batch #..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="h-9 pl-8 pr-8 text-xs font-mono"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </form>

                    {/* Allotment Today Quick Filter Button */}
                    <Button
                        type="button"
                        size="sm"
                        variant={isAllotmentTodayFilter ? 'default' : 'outline'}
                        onClick={toggleAllotmentTodayFilter}
                        className={`h-9 text-xs font-medium ${
                            isAllotmentTodayFilter
                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                                : 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-50'
                        }`}
                    >
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        Allotment Today {allotmentTodayCount > 0 ? `(${allotmentTodayCount})` : ''}
                    </Button>

                    <Select
                        value={selectedIpo}
                        onValueChange={(val) => {
                            setSelectedIpo(val);
                            handleFilterChange('ipo_id', val);
                        }}
                    >
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                            <SelectValue placeholder="All IPOs" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All IPOs</SelectItem>
                            {ipos.map((ipo) => (
                                <SelectItem key={ipo.id} value={String(ipo.id)}>
                                    {ipo.company_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {isAdmin && (
                        <Select
                            value={selectedUser}
                            onValueChange={(val) => {
                                setSelectedUser(val);
                                handleFilterChange('user_id', val);
                            }}
                        >
                            <SelectTrigger className="w-[150px] h-9 text-xs">
                                <SelectValue placeholder="All Users" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map((u) => (
                                    <SelectItem key={u.id} value={String(u.id)}>
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Select
                        value={selectedFunding}
                        onValueChange={(val) => {
                            setSelectedFunding(val);
                            handleFilterChange('funding_source', val);
                        }}
                    >
                        <SelectTrigger className="w-[140px] h-9 text-xs">
                            <SelectValue placeholder="Funding" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Funding</SelectItem>
                            <SelectItem value="my_money">My Money</SelectItem>
                            <SelectItem value="user_money">User Money</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={selectedStatus}
                        onValueChange={(val) => {
                            setSelectedStatus(val);
                            handleFilterChange('application_status', val);
                        }}
                    >
                        <SelectTrigger className="w-[140px] h-9 text-xs">
                            <SelectValue placeholder="App Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All App Statuses</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="allotted">Allotted</SelectItem>
                            <SelectItem value="not_allotted">Not Allotted</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={selectedSettlement}
                        onValueChange={(val) => {
                            setSelectedSettlement(val);
                            handleFilterChange('settlement_status', val);
                        }}
                    >
                        <SelectTrigger className="w-[140px] h-9 text-xs">
                            <SelectValue placeholder="Settlement" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Settlements</SelectItem>
                            <SelectItem value="estimated">Estimated</SelectItem>
                            <SelectItem value="settled">Settled</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Applications Table */}
                <Card>
                    <CardContent className="p-0">
                        {batches.data.length === 0 ? (
                            <div className="py-12 text-center text-sm text-neutral-500">
                                {isAllotmentTodayFilter
                                    ? 'No applications have scheduled allotment today.'
                                    : 'No applications match the selected criteria.'}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
                                        <tr>
                                            <th className="py-3 px-4">Applicant & PAN</th>
                                            <th className="py-3 px-4">IPO</th>
                                            <th className="py-3 px-4">Bank & UPI</th>
                                            <th className="py-3 px-4">Amount</th>
                                            <th className="py-3 px-4">Profit Sharing</th>
                                            <th className="py-3 px-4">Payout</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                        {batches.data.map((batch) => {
                                            const pans = batch.batch_pans || [];
                                            const panNumberRaw = batch.pan_number || (pans[0]?.pan_number_snapshot ?? '');
                                            const panDisplay = panNumberRaw
                                                ? (isAdmin ? panNumberRaw : `XXXXXX${panNumberRaw.slice(-4)}`)
                                                : null;

                                            const locallyChecked = checkedBatchIds[batch.id];
                                            const hasAutoCheckResult = Boolean(
                                                batch.allotment_details ||
                                                batch.allotment_checked_at ||
                                                locallyChecked
                                            );

                                            const isAllotted = batch.application_status === 'allotted' || (hasAutoCheckResult && (batch.allotment_details?.allotted || locallyChecked?.allotted));
                                            const isNotAllotted = batch.application_status === 'not_allotted' || (hasAutoCheckResult && (!batch.allotment_details?.allotted && !locallyChecked?.allotted));
                                            const isPendingApproval = batch.application_status === 'pending_approval';
                                            const isPending = !isAllotted && !isNotAllotted && batch.application_status !== 'cancelled' && !isPendingApproval && !hasAutoCheckResult;
                                            const appAmount = Number(batch.ipo_amount || batch.capital_amount || 0);

                                            const hasAllotmentDate = Boolean(batch.ipo?.allotment_date);
                                            const allotmentDateStr = batch.ipo?.allotment_date ? batch.ipo.allotment_date.split('T')[0] : null;
                                            const isAllotmentDateReached = Boolean(allotmentDateStr && todayIst >= allotmentDateStr);
                                            const isAllotmentToday = Boolean(allotmentDateStr && allotmentDateStr === todayIst);
                                            const showAllotmentButton = Boolean(
                                                panNumberRaw &&
                                                batch.application_status !== 'cancelled' &&
                                                hasAllotmentDate &&
                                                (isAllotmentDateReached || isAdmin)
                                            );

                                            return (
                                                <tr
                                                    key={batch.id}
                                                    className={`transition-colors ${
                                                        isAllotmentToday
                                                            ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                                                            : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50'
                                                    }`}
                                                >
                                                    <td className="py-3 px-4">
                                                        <span className="font-semibold block text-neutral-900 dark:text-neutral-100">
                                                            {batch.applicant_name || batch.user?.name || 'Applicant'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                            <span className="font-mono text-xs text-neutral-400">
                                                                {batch.batch_number}
                                                            </span>

                                                            {/* PAN Display & Quick Action */}
                                                            {panDisplay ? (
                                                                <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-700 dark:text-neutral-300 font-medium">
                                                                    PAN: {panDisplay}
                                                                    {isAdmin && panNumberRaw && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => copyPan(panNumberRaw)}
                                                                            className="text-neutral-400 hover:text-blue-600 transition-colors ml-0.5"
                                                                            title="Copy unmasked PAN"
                                                                        >
                                                                            {copiedPan === panNumberRaw ? (
                                                                                <CheckCheck className="h-3 w-3 text-emerald-600" />
                                                                            ) : (
                                                                                <Copy className="h-3 w-3" />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openPanModal(batch)}
                                                                        className="text-[10px] text-blue-600 hover:underline dark:text-blue-400 font-sans ml-1"
                                                                        title="Change or link saved PAN"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openPanModal(batch)}
                                                                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-dashed border-blue-300 dark:border-blue-800"
                                                                    title="Attach a saved PAN"
                                                                >
                                                                    <Plus className="h-3 w-3" /> Add Saved PAN
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 font-medium">
                                                        <Link href={`/ipos/${batch.ipo_id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                                                            {batch.ipo?.company_name}
                                                        </Link>
                                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                            <span className="text-[11px] text-neutral-400 block">
                                                                {batch.application_count} lot(s) ({batch.application_count * (batch.ipo?.lot_size || 1)} sh)
                                                            </span>
                                                            {isAllotmentToday ? (
                                                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] px-1 py-0 h-4">
                                                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Allotment Today
                                                                </Badge>
                                                            ) : hasAllotmentDate ? (
                                                                <span className="text-[10px] text-neutral-400 font-sans">
                                                                    Allotment: {formatIstDate(allotmentDateStr)}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {batch.bank_name ? (
                                                            <span className="inline-flex items-center gap-1 font-medium text-xs text-neutral-700 dark:text-neutral-300">
                                                                <Landmark className="h-3.5 w-3.5 text-blue-500" />
                                                                {batch.bank_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-neutral-400">—</span>
                                                        )}
                                                        {batch.upi_id && (
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[11px] font-mono text-neutral-500 block truncate max-w-[130px]" title={batch.upi_id}>
                                                                    {batch.upi_id}
                                                                </span>
                                                                {batch.upi_app && (
                                                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 border font-medium ${getUpiAppBadgeClass(batch.upi_app)}`}>
                                                                        {batch.upi_app}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                                            {formatInr(appAmount)}
                                                        </span>
                                                        <span className="text-[11px] text-neutral-400 block uppercase">
                                                            {batch.funding_source === 'my_money' ? (isAdmin ? 'Admin Capital' : 'Sponsored') : 'Self-Funded'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {batch.profit_sharing_type === 'percentage' ? (
                                                            <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                                                {batch.profit_sharing_value}% Listing Gain
                                                            </Badge>
                                                        ) : batch.profit_sharing_type === 'fix' ? (
                                                            <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                                                Fixed ₹{batch.profit_sharing_value}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                Rate ₹{batch.published_rate_snapshot}
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="font-semibold text-emerald-600 block">
                                                            {formatInr(isAllotted ? (batch.settled_user_payout ?? batch.expected_user_payout) : isNotAllotted ? 0 : batch.expected_user_payout)}
                                                        </span>
                                                        {isPending && (
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal block">
                                                                Finalized Listing + T+1
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="space-y-1">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[10px] uppercase font-semibold ${
                                                                    isAllotted
                                                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                        : isNotAllotted
                                                                        ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                                        : isPendingApproval
                                                                        ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                                                        : 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                                                }`}
                                                            >
                                                                {isAllotted ? 'Allotted' : isNotAllotted ? 'Not Allotted' : isPendingApproval ? 'Pending Approval' : batch.application_status.replace('_', ' ')}
                                                            </Badge>

                                                            {/* If KFintech allotment was scraped, show badge with click to inspect */}
                                                            {batch.allotment_details && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setAllotmentBatch(batch);
                                                                        setAllotmentResult({
                                                                            success: true,
                                                                            found: true,
                                                                            allotted: batch.allotment_details?.allotted,
                                                                            all_shares: batch.allotment_details?.allotted_shares,
                                                                            app_shares: batch.allotment_details?.applied_shares,
                                                                            application_number: batch.allotment_details?.application_number,
                                                                            name_from_pan: batch.allotment_details?.name_from_pan,
                                                                            dp_clid: batch.allotment_details?.dp_clid,
                                                                            pan_masked: batch.allotment_details?.pan_masked,
                                                                            pan_full: panNumberRaw || undefined,
                                                                            kfin_ipo_name: batch.allotment_details?.kfin_ipo_name,
                                                                            checked_at: batch.allotment_details?.checked_at,
                                                                        });
                                                                        setAllotmentModalOpen(true);
                                                                    }}
                                                                    className="block text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
                                                                >
                                                                    KFintech Details ↗
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                            {/* Admin Approval Actions for Fix Rate Applications */}
                                                            {isPendingApproval && isAdmin && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleApprove(batch.id)}
                                                                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                                                        title="Approve Fixed Application"
                                                                    >
                                                                        <Check className="h-3 w-3 mr-1" /> Approve
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleReject(batch.id)}
                                                                        className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                        title="Reject Fixed Application"
                                                                    >
                                                                        <X className="h-3 w-3 mr-1" /> Reject
                                                                    </Button>
                                                                </>
                                                            )}

                                                            {/* Check Allotment Button (Only visible when allotment date is present and reached) */}
                                                            {showAllotmentButton && (
                                                                <Button
                                                                    size="sm"
                                                                    variant={isAllotmentToday ? 'default' : 'outline'}
                                                                    onClick={() => handleCheckAllotment(batch)}
                                                                    className={`h-7 px-2.5 text-xs font-semibold ${
                                                                        isAllotmentToday
                                                                            ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm ring-1 ring-sky-400'
                                                                            : 'border-sky-400 text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/50'
                                                                    }`}
                                                                    title={isAllotmentToday ? 'Today is Allotment Day! Live query KFintech' : `Live query KFintech (Allotment: ${formatIstDate(allotmentDateStr)})`}
                                                                >
                                                                    <Search className={`h-3 w-3 mr-1 ${isAllotmentToday ? 'text-white' : 'text-sky-600'}`} /> Check Allotment
                                                                </Button>
                                                            )}

                                                            {isPending && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleStatusChange(batch.id, 'allotted')}
                                                                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                                                        title="Manually Mark Allotted"
                                                                    >
                                                                        <Check className="h-3 w-3 mr-1" /> Allotted
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleStatusChange(batch.id, 'not_allotted')}
                                                                        className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                        title="Manually Mark Not Allotted"
                                                                    >
                                                                        <X className="h-3 w-3 mr-1" /> Not Allotted
                                                                    </Button>
                                                                </>
                                                            )}

                                                            {isAllotted && (
                                                                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Allotted
                                                                </span>
                                                            )}

                                                            {isNotAllotted && (
                                                                <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800">
                                                                    <X className="h-3.5 w-3.5 mr-1 text-rose-600" /> Not Allotted
                                                                </span>
                                                            )}

                                                            {/* Cancel Button */}
                                                            {batch.application_status !== 'cancelled' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-neutral-400 hover:text-amber-600 h-7 text-xs px-1.5"
                                                                    onClick={() => setCancellingBatch(batch)}
                                                                    title="Cancel Application"
                                                                >
                                                                    <Ban className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}

                                                            {/* Delete Button */}
                                                            {(isAdmin || batch.settlement_status !== 'settled') && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-neutral-400 hover:text-red-600 h-7 text-xs px-1.5"
                                                                    onClick={() => setDeletingBatch(batch)}
                                                                    title="Delete Application"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Attach / Update PAN Modal */}
            <Dialog open={!!panModalBatch} onOpenChange={() => setPanModalBatch(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-600" />
                            {panModalPanNumber ? 'Update PAN' : 'Attach PAN'} for {panModalBatch?.batch_number}
                        </DialogTitle>
                        <DialogDescription>
                            Select a saved PAN with search or enter a new one to enable KFintech live allotment verification.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handlePanModalSubmit} className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="modal_pan">PAN Number *</Label>
                                {userPans.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPanModalIsNewPan(!panModalIsNewPan);
                                            setPanModalDropdownOpen(false);
                                            if (!panModalIsNewPan) {
                                                setPanModalPanId('');
                                                setPanModalPanNumber('');
                                            }
                                        }}
                                        className="text-[11px] text-blue-600 hover:underline dark:text-blue-400 font-medium"
                                    >
                                        {panModalIsNewPan ? 'Select Saved PAN' : '+ Type New PAN'}
                                    </button>
                                )}
                            </div>

                            {!panModalIsNewPan && userPans.length > 0 ? (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setPanModalDropdownOpen(!panModalDropdownOpen)}
                                        className="w-full flex items-center justify-between h-9 px-3 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition"
                                    >
                                        {panModalPanNumber ? (
                                            <div className="flex items-center gap-1.5 truncate text-left">
                                                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                                    {isAdmin ? panModalPanNumber : `XXXXXX${panModalPanNumber.slice(-4)}`}
                                                </span>
                                                {(() => {
                                                    const matched = userPans.find((p) => p.pan_number === panModalPanNumber);
                                                    return matched?.account_holder_name ? (
                                                        <span className="text-neutral-500 truncate text-[11px]">
                                                            • {matched.account_holder_name}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                        ) : (
                                            <span className="text-neutral-400">Select or search saved PAN...</span>
                                        )}
                                        <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 shrink-0 ml-1 transition-transform ${panModalDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {panModalDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-2 space-y-1.5">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                                                <Input
                                                    placeholder="Search PAN, name, broker..."
                                                    value={panModalSearchQuery}
                                                    onChange={(e) => setPanModalSearchQuery(e.target.value)}
                                                    className="h-8 pl-8 text-xs font-normal"
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                                                {filteredSavedPans.length === 0 ? (
                                                    <div className="py-3 px-2 text-center text-xs text-neutral-400">
                                                        No saved PANs match "{panModalSearchQuery}".
                                                        {panModalSearchQuery.trim().length === 10 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPanModalPanNumber(panModalSearchQuery.trim().toUpperCase());
                                                                    setPanModalPanId('');
                                                                    setPanModalDropdownOpen(false);
                                                                }}
                                                                className="block mx-auto mt-1.5 text-xs text-blue-600 hover:underline font-semibold"
                                                            >
                                                                Use "{panModalSearchQuery.trim().toUpperCase()}"
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    filteredSavedPans.map((p) => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => handleSelectModalSavedPan(p)}
                                                            className={`w-full text-left py-2 px-2.5 rounded-md text-xs flex items-center justify-between transition ${
                                                                panModalPanNumber === p.pan_number
                                                                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                                                                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                                                            }`}
                                                        >
                                                            <div>
                                                                <div className="flex items-center gap-1.5 font-mono">
                                                                    <span className="font-bold">{isAdmin ? p.pan_number : p.masked_pan}</span>
                                                                    {p.broker_name && (
                                                                        <span className="text-[10px] text-neutral-400 font-sans">
                                                                            ({p.broker_name})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {p.account_holder_name && (
                                                                    <span className="text-[11px] text-neutral-500 block truncate max-w-[200px]">
                                                                        {p.account_holder_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {isAdmin && p.user?.name && (
                                                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-neutral-300">
                                                                    {p.user.name}
                                                                </Badge>
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>

                                            <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center text-[11px]">
                                                <span className="text-neutral-400">Total: {userPans.length} saved</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPanModalIsNewPan(true);
                                                        setPanModalDropdownOpen(false);
                                                        setPanModalPanNumber('');
                                                        setPanModalPanId('');
                                                    }}
                                                    className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
                                                >
                                                    + Type New PAN
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Input
                                    id="modal_pan"
                                    placeholder="e.g. ABCDE1234F"
                                    maxLength={10}
                                    value={panModalPanNumber}
                                    onChange={(e) => setPanModalPanNumber(e.target.value.toUpperCase())}
                                    className="font-mono uppercase text-sm"
                                    required
                                    autoFocus
                                />
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="modal_applicant_name">Applicant Name (Optional)</Label>
                            <Input
                                id="modal_applicant_name"
                                placeholder="e.g. Rahul Sharma"
                                value={panModalApplicantName}
                                onChange={(e) => setPanModalApplicantName(e.target.value)}
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPanModalBatch(null)}
                                disabled={isSavingPan}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                disabled={isSavingPan || (!panModalPanId && panModalPanNumber.trim().length !== 10)}
                            >
                                {isSavingPan ? 'Saving...' : 'Save & Attach PAN'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* KFintech Allotment Status Modal */}
            <KfintechAllotmentModal
                isOpen={allotmentModalOpen}
                onClose={() => setAllotmentModalOpen(false)}
                isLoading={allotmentLoading}
                result={allotmentResult}
                companyName={allotmentBatch?.ipo?.company_name}
                batchNumber={allotmentBatch?.batch_number}
                onRecheck={() => allotmentBatch && handleCheckAllotment(allotmentBatch)}
            />

            {/* Delete Batch Confirmation Modal */}
            <Dialog open={!!deletingBatch} onOpenChange={() => setDeletingBatch(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Delete Application: {deletingBatch?.batch_number}
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to permanently delete this application for{' '}
                            <strong>{deletingBatch?.ipo?.company_name}</strong>? This action will remove all linked records and cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeletingBatch(null)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteSubmit}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Application'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Batch Modal */}
            <Dialog open={!!cancellingBatch} onOpenChange={() => setCancellingBatch(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancel Batch: {cancellingBatch?.batch_number}</DialogTitle>
                        <DialogDescription>
                            Cancelling marks the batch as invalid while retaining historical records.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCancelSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="cancel_reason">Cancellation Reason *</Label>
                            <Input
                                id="cancel_reason"
                                required
                                placeholder="e.g. Applicant requested withdrawal, Demat rejected"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCancellingBatch(null)}>
                                Back
                            </Button>
                            <Button type="submit" variant="destructive">
                                Confirm Cancellation
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
