import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Building2,
    Calculator,
    Calendar,
    Check,
    CheckCheck,
    CheckCircle2,
    ChevronDown,
    Clock,
    Copy,
    CreditCard,
    DollarSign,
    Download,
    Edit3,
    ExternalLink,
    Eye,
    FileSpreadsheet,
    FileText,
    History,
    Landmark,
    Percent,
    PieChart,
    Plus,
    RefreshCw,
    Search,
    Settings,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Sparkles,
    ToggleLeft,
    ToggleRight,
    Trash2,
    TrendingUp,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { useState } from 'react';
import KfintechAllotmentModal, { type AllotmentResultData } from '@/components/kfintech-allotment-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { ApplicationBatch, BankAccount, BreadcrumbItem, Ipo, User, UserPan, UserUpi } from '@/types';

interface IpoShowProps {
    ipo: Ipo;
    batches: ApplicationBatch[];
    financials: {
        total_applications: number;
        my_money: {
            applications: number;
            capital_deployed: number;
            expected_gross_profit: number;
            expected_user_payout: number;
            expected_net_earnings: number;
            realized_net_earnings: number;
            capital_returned: number;
        };
        user_money: {
            applications: number;
            capital_recorded: number;
            expected_gross_profit: number;
            expected_user_payout: number;
            expected_net_earnings: number;
            realized_net_earnings: number;
        };
    };
    usersList: User[];
    userPans: UserPan[];
    bankAccounts?: BankAccount[];
    userUpis?: UserUpi[];
    isAdmin: boolean;
}

export default function IpoShow({
    ipo,
    batches,
    financials,
    usersList,
    userPans,
    bankAccounts = [],
    userUpis = [],
    isAdmin: isAdminProp,
}: IpoShowProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const isAdmin = auth.user?.role === 'admin';

    const getInitialTab = (): 'overview' | 'applications' | 'rates' | 'funding' | 'exports' => {
        if (typeof window === 'undefined') return 'overview';
        const param = new URLSearchParams(window.location.search).get('tab');
        if (param && ['overview', 'applications', 'rates', 'funding', 'exports'].includes(param)) {
            return param as 'overview' | 'applications' | 'rates' | 'funding' | 'exports';
        }
        return 'overview';
    };
    const [activeTab, setActiveTabState] = useState<'overview' | 'applications' | 'rates' | 'funding' | 'exports'>(getInitialTab);

    const setActiveTab = (tab: 'overview' | 'applications' | 'rates' | 'funding' | 'exports') => {
        setActiveTabState(tab);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            window.history.replaceState({}, '', url.toString());
        }
    };

    // Modals
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [isGmpModalOpen, setIsGmpModalOpen] = useState(false);
    const [gmpInput, setGmpInput] = useState(ipo.gmp !== null && ipo.gmp !== undefined ? String(ipo.gmp) : '');
    const [calculatorLots, setCalculatorLots] = useState(1);
    const [copiedIsin, setCopiedIsin] = useState(false);
    const [settlingBatch, setSettlingBatch] = useState<ApplicationBatch | null>(null);

    // Bank modal state
    const [newBankName, setNewBankName] = useState('');
    const [inlineBankName, setInlineBankName] = useState('');
    const [isAddingNewBank, setIsAddingNewBank] = useState(false);
    const [bankModalTab, setBankModalTab] = useState<'banks' | 'upis'>('banks');
    const [inlineUpiBankId, setInlineUpiBankId] = useState<number | null>(null);
    const [inlineUpiText, setInlineUpiText] = useState('');
    const [inlineUpiApp, setInlineUpiApp] = useState('Auto');

    // Rate modal state
    const [traderRateInput, setTraderRateInput] = useState(ipo.active_rate?.trader_rate ? String(ipo.active_rate.trader_rate) : '');
    const [publishedRateInput, setPublishedRateInput] = useState(ipo.active_rate?.published_rate ? String(ipo.active_rate.published_rate) : '');
    const [rateNoteInput, setRateNoteInput] = useState('');

    // Application / Batch modal state
    const [applicantName, setApplicantName] = useState(auth.user.name || '');
    const [bankName, setBankName] = useState(bankAccounts[0]?.bank_name || '');
    const [panNumber, setPanNumber] = useState('');
    const [isAddingNewPan, setIsAddingNewPan] = useState(userPans.length === 0);
    const [panSearchQuery, setPanSearchQuery] = useState('');
    const [isPanDropdownOpen, setIsPanDropdownOpen] = useState(false);
    const [upiId, setUpiId] = useState('');
    const [upiApp, setUpiApp] = useState('Auto');
    const [isAddingNewUpi, setIsAddingNewUpi] = useState(false);
    const [newUpiId, setNewUpiId] = useState('');
    const [newUpiApp, setNewUpiApp] = useState('Auto');
    const [newUpiBankId, setNewUpiBankId] = useState<string>('none');
    const [profitSharingType, setProfitSharingType] = useState<'fix' | 'percentage' | 'rate_margin'>(
        ipo.active_rate ? 'rate_margin' : 'fix'
    );
    const [profitSharingValue, setProfitSharingValue] = useState(
        ipo.active_rate ? String(ipo.active_rate.published_rate) : '500'
    );
    const [batchUserId, setBatchUserId] = useState(isAdmin ? (usersList[0]?.id ? String(usersList[0].id) : '') : String(auth.user.id));
    const [batchCount, setBatchCount] = useState('1');
    const [batchFunding, setBatchFunding] = useState<'my_money' | 'user_money'>(isAdmin ? 'my_money' : 'user_money');
    const [batchPanId, setBatchPanId] = useState('');
    const [batchNotes, setBatchNotes] = useState('');
    const [batchTraderRef, setBatchTraderRef] = useState('');

    // Bulk apply state
    const [applyMode, setApplyMode] = useState<'single' | 'bulk'>('single');
    const [selectedBulkPanIds, setSelectedBulkPanIds] = useState<number[]>([]);
    const [bulkPanSearchQuery, setBulkPanSearchQuery] = useState('');
    const [bulkUserFilter, setBulkUserFilter] = useState<string>('all');

    const todayIst = getIstToday();
    const hasIpoAllotmentDate = Boolean(ipo.allotment_date);
    const ipoAllotmentDateStr = ipo.allotment_date ? ipo.allotment_date.split('T')[0] : null;
    const isIpoAllotmentDateReached = Boolean(ipoAllotmentDateStr && todayIst >= ipoAllotmentDateStr);
    const isIpoAllotmentToday = Boolean(ipoAllotmentDateStr && ipoAllotmentDateStr === todayIst);

    // Filter userPans by search query
    const filteredPans = userPans.filter((p) => {
        const q = panSearchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            p.pan_number?.toLowerCase().includes(q) ||
            p.masked_pan?.toLowerCase().includes(q) ||
            p.account_holder_name?.toLowerCase().includes(q) ||
            p.broker_name?.toLowerCase().includes(q) ||
            p.notes?.toLowerCase().includes(q) ||
            p.user?.name?.toLowerCase().includes(q)
        );
    });

    const handleSelectSavedPan = (selectedPan: UserPan) => {
        setPanNumber(selectedPan.pan_number);
        setBatchPanId(String(selectedPan.id));
        if (selectedPan.account_holder_name) {
            setApplicantName(selectedPan.account_holder_name);
        }
        if (isAdmin && selectedPan.user_id) {
            setBatchUserId(String(selectedPan.user_id));
        }
        setIsPanDropdownOpen(false);
        setPanSearchQuery('');
    };

    // Filter userPans for Bulk Apply
    const filteredBulkPans = userPans.filter((p) => {
        if (isAdmin && bulkUserFilter !== 'all' && String(p.user_id) !== bulkUserFilter) {
            return false;
        }
        const q = bulkPanSearchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            p.pan_number?.toLowerCase().includes(q) ||
            p.masked_pan?.toLowerCase().includes(q) ||
            p.account_holder_name?.toLowerCase().includes(q) ||
            p.broker_name?.toLowerCase().includes(q) ||
            p.notes?.toLowerCase().includes(q) ||
            p.user?.name?.toLowerCase().includes(q)
        );
    });

    const toggleSelectAllBulkPans = () => {
        const selectableIds = filteredBulkPans.map((p) => p.id);
        const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedBulkPanIds.includes(id));
        if (allSelected) {
            setSelectedBulkPanIds((prev) => prev.filter((id) => !selectableIds.includes(id)));
        } else {
            setSelectedBulkPanIds((prev) => Array.from(new Set([...prev, ...selectableIds])));
        }
    };

    const toggleBulkPanId = (id: number) => {
        setSelectedBulkPanIds((prev) =>
            prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
        );
    };

    // Settlement modal state
    const [settleActualGross, setSettleActualGross] = useState('');
    const [settleActualPayout, setSettleActualPayout] = useState('');
    const [settleNetEarnings, setSettleNetEarnings] = useState('');
    const [settleCapitalReturned, setSettleCapitalReturned] = useState('');
    const [settleDate, setSettleDate] = useState(todayIst);
    const [settleNotes, setSettleNotes] = useState('');

    // Delete batch modal
    const [deletingBatch, setDeletingBatch] = useState<ApplicationBatch | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // KFintech Allotment modal
    const [allotmentModalOpen, setAllotmentModalOpen] = useState(false);
    const [allotmentLoading, setAllotmentLoading] = useState(false);
    const [allotmentResult, setAllotmentResult] = useState<AllotmentResultData | null>(null);
    const [allotmentBatch, setAllotmentBatch] = useState<ApplicationBatch | null>(null);
    const [isCheckingAllAllotments, setIsCheckingAllAllotments] = useState(false);
    const [checkedBatchIds, setCheckedBatchIds] = useState<Record<number, { allotted: boolean; details: any }>>({});

    // PAN copy indicator
    const [copiedPan, setCopiedPan] = useState<string | null>(null);

    const copyPan = (pan: string) => {
        navigator.clipboard.writeText(pan);
        setCopiedPan(pan);
        setTimeout(() => setCopiedPan(null), 2000);
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

    const handleCheckAllAllotments = () => {
        setIsCheckingAllAllotments(true);
        router.post(`/ipos/${ipo.id}/check-allotments`, {}, {
            preserveScroll: true,
            onFinish: () => setIsCheckingAllAllotments(false),
        });
    };

    const handleToggleFixApplications = () => {
        router.post(`/ipos/${ipo.id}/toggle-fix`, {}, { preserveScroll: true });
    };

    const handleToggleAutoApproveFix = () => {
        router.post(`/ipos/${ipo.id}/toggle-auto-approve-fix`, {}, { preserveScroll: true });
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

    const handleApproveAll = () => {
        router.post(`/ipos/${ipo.id}/applications/approve-all`, {}, { preserveScroll: true });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'IPOs',
            href: '/ipos',
        },
        {
            title: ipo.company_name,
            href: `/ipos/${ipo.id}`,
        },
    ];

    const formatInr = (amount: number | string | null | undefined) => {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(val);
    };

    const formatDateShort = (dateStr?: string | null) => {
        if (!dateStr) return 'TBD';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } catch {
            return dateStr;
        }
    };

    const detectUpiApp = (val: string): string => {
        const lower = val.toLowerCase();
        if (lower.includes('@okhdfc') || lower.includes('@okaxis') || lower.includes('@oksbi') || lower.includes('@okicici')) return 'Google Pay';
        if (lower.includes('@ybl') || lower.includes('@ibl') || lower.includes('@axl')) return 'PhonePe';
        if (lower.includes('paytm') || lower.includes('@ptaxis') || lower.includes('@pthdfc') || lower.includes('@ptsbi')) return 'Paytm';
        if (lower.includes('@upi')) return 'BHIM';
        if (lower.includes('@cred')) return 'Cred';
        if (lower.includes('@apl') || lower.includes('@rapl')) return 'Amazon Pay';
        return 'Other';
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

    const handleRateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(`/ipos/${ipo.id}/rates`, {
            trader_rate: traderRateInput,
            published_rate: publishedRateInput,
            note: rateNoteInput,
        }, {
            onSuccess: () => setIsRateModalOpen(false),
        });
    };

    const handleGmpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(`/ipos/${ipo.id}/gmp`, {
            gmp: gmpInput !== '' ? Number(gmpInput) : null,
        }, {
            preserveScroll: true,
            onSuccess: () => setIsGmpModalOpen(false),
        });
    };

    const handleBatchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const resolvedUpiApp = upiId ? (upiApp !== 'Auto' ? upiApp : detectUpiApp(upiId)) : null;

        if (applyMode === 'bulk') {
            if (selectedBulkPanIds.length === 0) {
                alert('Please select at least one saved PAN card for bulk application.');
                return;
            }
            router.post('/applications', {
                ipo_id: ipo.id,
                user_id: isAdmin ? (bulkUserFilter !== 'all' ? bulkUserFilter : (batchUserId || auth.user.id)) : auth.user.id,
                bank_name: bankName || null,
                upi_id: upiId ? upiId.toLowerCase().trim() : null,
                upi_app: resolvedUpiApp,
                profit_sharing_type: profitSharingType,
                profit_sharing_value: profitSharingValue ? Number(profitSharingValue) : 0,
                pan_ids: selectedBulkPanIds,
                funding_source: isAdmin ? batchFunding : 'user_money',
                notes: batchNotes,
                trader_reference: batchTraderRef,
            }, {
                onSuccess: () => {
                    setIsBatchModalOpen(false);
                    setSelectedBulkPanIds([]);
                    setBatchNotes('');
                },
            });
            return;
        }

        router.post('/applications', {
            ipo_id: ipo.id,
            user_id: isAdmin ? batchUserId : auth.user.id,
            applicant_name: applicantName || null,
            bank_name: bankName || null,
            pan_number: panNumber ? panNumber.toUpperCase().trim() : null,
            upi_id: upiId ? upiId.toLowerCase().trim() : null,
            upi_app: resolvedUpiApp,
            profit_sharing_type: profitSharingType,
            profit_sharing_value: profitSharingValue ? Number(profitSharingValue) : 0,
            application_count: batchCount,
            funding_source: isAdmin ? batchFunding : 'user_money',
            pan_id: batchPanId || null,
            notes: batchNotes,
            trader_reference: batchTraderRef,
        }, {
            onSuccess: () => {
                setIsBatchModalOpen(false);
                setBatchCount('1');
                setBatchNotes('');
            },
        });
    };

    const handleStatusChange = (batchId: number, status: 'allotted' | 'not_allotted') => {
        router.post(`/applications/${batchId}/status`, {
            application_status: status,
        }, {
            preserveScroll: true,
        });
    };

    const handleSaveBank = (name: string, e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        router.post('/bank-accounts', { bank_name: trimmed }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewBankName('');
                setInlineBankName('');
                setIsAddingNewBank(false);
                setBankName(trimmed);
            },
        });
    };

    const handleDeleteBank = (id: number) => {
        router.delete(`/bank-accounts/${id}`, { preserveScroll: true });
    };

    const handleSaveUpi = (upiVal: string, appVal: string, bankId?: string | number | null, e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = upiVal.trim().toLowerCase();
        if (!trimmed) return;
        const resolvedApp = appVal && appVal !== 'Auto' ? appVal : detectUpiApp(trimmed);
        router.post('/user-upis', {
            upi_id: trimmed,
            upi_app: resolvedApp,
            bank_account_id: bankId && bankId !== 'none' ? Number(bankId) : null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewUpiId('');
                setNewUpiApp('Auto');
                setUpiId(trimmed);
                setUpiApp(resolvedApp);
                setIsAddingNewUpi(false);
            },
        });
    };

    const handleDeleteUpi = (id: number) => {
        router.delete(`/user-upis/${id}`, { preserveScroll: true });
    };

    const openSettlementModal = (batch: ApplicationBatch) => {
        setSettlingBatch(batch);
        setSettleActualGross(String(batch.expected_gross_profit));
        setSettleActualPayout(String(batch.expected_user_payout));
        setSettleNetEarnings(String(batch.expected_net_earnings));
        setSettleCapitalReturned(String(batch.capital_amount));
    };

    const handleSettlementSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!settlingBatch) return;

        router.post(`/applications/${settlingBatch.id}/settle`, {
            settlement_date: settleDate,
            actual_gross_profit: settleActualGross,
            actual_user_payout: settleActualPayout,
            actual_net_earnings: settleNetEarnings,
            capital_returned: settleCapitalReturned,
            settlement_method: 'rate_margin',
            notes: settleNotes,
        }, {
            onSuccess: () => setSettlingBatch(null),
        });
    };

    // Live auto calculations for IPO & API
    const lotSize = Number(ipo.lot_size) || 1;
    const priceBandMax = Number(ipo.price_band_max || ipo.issue_price || 0);
    const currentGmp = Number(ipo.gmp || 0);
    const parsedBatchCount = Math.max(1, Number(batchCount) || 1);
    const effectiveMultiplier = applyMode === 'bulk' ? selectedBulkPanIds.length : parsedBatchCount;

    // Auto-calculated IPO Amount
    const calculatedIpoAmount = lotSize * priceBandMax * effectiveMultiplier;
    // Expected listing gain based on GMP
    const calculatedListingGain = lotSize * currentGmp * effectiveMultiplier;

    const activePublishedRate = Number(ipo.active_rate?.published_rate || 0);
    const activeTraderRate = Number(ipo.active_rate?.trader_rate || 0);

    let previewUserPayout = 0;
    let previewGrossProfit = 0;
    let previewNetEarnings = 0;

    if (effectiveMultiplier > 0) {
        if (profitSharingType === 'fix') {
            const val = Number(profitSharingValue) || 0;
            previewUserPayout = val * effectiveMultiplier;
            previewGrossProfit = calculatedListingGain > 0 ? calculatedListingGain : previewUserPayout;
            previewNetEarnings = Math.max(0, previewGrossProfit - previewUserPayout);
        } else if (profitSharingType === 'percentage') {
            const pct = Number(profitSharingValue) || 0;
            previewGrossProfit = calculatedListingGain;
            previewUserPayout = (pct / 100) * previewGrossProfit;
            previewNetEarnings = previewGrossProfit - previewUserPayout;
        } else {
            previewUserPayout = activePublishedRate * effectiveMultiplier;
            previewGrossProfit = activeTraderRate * effectiveMultiplier;
            previewNetEarnings = (activeTraderRate - activePublishedRate) * effectiveMultiplier;
        }
    }
    const previewMarginTotal = previewNetEarnings;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${ipo.company_name} — Workspace`} />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header Workspace Bar */}
                <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800 md:flex-row md:items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                <Link href="/ipos" prefetch="hover">
                                    <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
                                </Link>
                            </Button>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                {ipo.ipo_type} · {ipo.exchange}
                            </Badge>
                            <Badge
                                className={`text-[10px] capitalize ${
                                    ipo.status === 'open'
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                        : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                }`}
                            >
                                {ipo.status}
                            </Badge>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                            {ipo.company_name} {ipo.symbol && <span className="text-neutral-400 font-normal">({ipo.symbol})</span>}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {isAdmin && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleToggleFixApplications}
                                    className={`text-xs h-9 ${
                                        ipo.accept_fix_applications !== false
                                            ? 'border-purple-300 text-purple-700 bg-purple-50/80 dark:bg-purple-950/40 dark:text-purple-300'
                                            : 'border-neutral-300 text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                                    }`}
                                    title="Enable or disable accepting Fixed Rate applications for this IPO"
                                >
                                    {ipo.accept_fix_applications !== false ? (
                                        <>
                                            <ToggleRight className="mr-1.5 h-4 w-4 text-purple-600" />
                                            Fix Apps: ON
                                        </>
                                    ) : (
                                        <>
                                            <ToggleLeft className="mr-1.5 h-4 w-4 text-neutral-400" />
                                            Fix Apps: OFF
                                        </>
                                    )}
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleToggleAutoApproveFix}
                                    className={`text-xs h-9 ${
                                        ipo.auto_approve_fix !== false
                                            ? 'border-emerald-300 text-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/40 dark:text-emerald-300'
                                            : 'border-amber-300 text-amber-700 bg-amber-50/80 dark:bg-amber-950/40 dark:text-amber-300'
                                    }`}
                                    title="When ON, fix applications are auto-approved. When OFF, they require admin approval."
                                >
                                    {ipo.auto_approve_fix !== false ? (
                                        <>
                                            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                                            Auto-Approve: ON
                                        </>
                                    ) : (
                                        <>
                                            <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                                            Auto-Approve: OFF
                                        </>
                                    )}
                                </Button>

                                {hasIpoAllotmentDate && (isIpoAllotmentDateReached || isAdmin) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCheckAllAllotments}
                                        disabled={isCheckingAllAllotments}
                                        className="border-sky-300 text-sky-700 bg-sky-50/80 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 text-xs h-9"
                                        title="Check and scrape all application PANs against KFintech portal"
                                    >
                                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 text-sky-600 ${isCheckingAllAllotments ? 'animate-spin' : ''}`} />
                                        {isCheckingAllAllotments ? 'Checking...' : 'Check All KFintech'}
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    onClick={() => setIsRateModalOpen(true)}
                                    className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 h-9 text-xs"
                                >
                                    <Settings className="mr-1.5 h-3.5 w-3.5" />
                                    {ipo.active_rate ? 'Update Rates' : 'Configure Rates'}
                                </Button>
                            </>
                        )}

                        <Button
                            onClick={() => {
                                setApplicantName(auth.user.name || '');
                                setBatchUserId(isAdmin ? (usersList[0]?.id ? String(usersList[0].id) : '') : String(auth.user.id));
                                setBatchFunding(isAdmin ? 'my_money' : 'user_money');
                                setIsBatchModalOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {isAdmin ? 'Record Application' : 'Apply for IPO'}
                        </Button>
                    </div>
                </div>

                {/* Allotment Day Alert Banner */}
                {isIpoAllotmentToday && (
                    <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-amber-950/40">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                        Today is Allotment Day for {ipo.company_name}!
                                        <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                                            {batches.length} Applications
                                        </Badge>
                                    </h3>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                        Registrar allotment status is scheduled for today. Run KFintech scraper to verify allotment across all applications.
                                    </p>
                                </div>
                            </div>
                            {isAdmin && (
                                <Button
                                    size="sm"
                                    onClick={handleCheckAllAllotments}
                                    disabled={isCheckingAllAllotments}
                                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm shrink-0"
                                >
                                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isCheckingAllAllotments ? 'animate-spin' : ''}`} />
                                    {isCheckingAllAllotments ? 'Checking Status...' : 'Check All Allotments'}
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Tabs Navigation (Swipeable on mobile) */}
                <div className="flex border-b border-neutral-200 dark:border-neutral-800 space-x-3 sm:space-x-6 text-xs sm:text-sm font-medium overflow-x-auto no-scrollbar whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                            activeTab === 'overview'
                                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        <PieChart className="h-4 w-4" /> Overview
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('applications')}
                        className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                            activeTab === 'applications'
                                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        <FileText className="h-4 w-4" /> Applications ({batches.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('rates')}
                        className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                            activeTab === 'rates'
                                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        <History className="h-4 w-4" /> Rates & History
                    </button>

                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('funding')}
                            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                                activeTab === 'funding'
                                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                            }`}
                        >
                            <Wallet className="h-4 w-4" /> Funding & Profit
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setActiveTab('exports')}
                        className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                            activeTab === 'exports'
                                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        <Download className="h-4 w-4" /> Exports (CSV)
                    </button>
                </div>

                {/* TAB A: OVERVIEW - Compact, Low-Scroll Bento Layout */}
                {activeTab === 'overview' && (
                    <div className="space-y-4">
                        {/* Mobile Quick Action Banner to Applications tab */}
                        <div className="flex sm:hidden items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                                    {batches.length} Applications Recorded
                                </span>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveTab('applications')}
                                className="h-7 px-2.5 text-[11px] font-semibold bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                            >
                                View Applications &rarr;
                            </Button>
                        </div>
                        {/* 1. Above the fold: 4 Compact Key Metric Cards */}
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {/* Card 1: Price & Minimum Lot */}
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                                    Price & Lot Size
                                </span>
                                <div className="mt-1.5 flex items-baseline gap-1">
                                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                                        {ipo.price_band_min && ipo.price_band_max
                                            ? `₹${ipo.price_band_min} - ₹${ipo.price_band_max}`
                                            : ipo.issue_price
                                            ? `₹${ipo.issue_price}`
                                            : 'TBD'}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                                    1 Lot = <span className="font-semibold text-neutral-700 dark:text-neutral-200">{ipo.lot_size} Shares</span>
                                    {priceBandMax > 0 && ` (₹${(lotSize * priceBandMax).toLocaleString('en-IN')})`}
                                </p>
                            </div>

                            {/* Card 2: Grey Market Premium (GMP) */}
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                        Grey Market (GMP)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setGmpInput(ipo.gmp !== null && ipo.gmp !== undefined ? String(ipo.gmp) : '');
                                            setIsGmpModalOpen(true);
                                        }}
                                        className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 hover:underline"
                                    >
                                        <Edit3 className="h-3 w-3" />
                                        {ipo.gmp !== null && ipo.gmp !== undefined ? 'Edit' : '+ Set'}
                                    </button>
                                </div>
                                <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                                        {ipo.gmp !== null && ipo.gmp !== undefined ? `+₹${ipo.gmp}` : 'N/A'}
                                    </span>
                                    {ipo.gmp !== null && ipo.gmp !== undefined && priceBandMax > 0 && (
                                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/70 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                            +{((Number(ipo.gmp) / priceBandMax) * 100).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                                    Est. Gain: <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        ₹{(lotSize * currentGmp).toLocaleString('en-IN')}
                                    </span> / lot
                                    {ipo.raw_provider_data?.gmp_source === 'investorgain' && (
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1.5 font-normal">
                                            · InvestorGain Live
                                        </span>
                                    )}
                                </p>
                            </div>

                            {/* Card 3: Demand & Status */}
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                                    Total Subscription
                                </span>
                                <div className="mt-1.5 flex items-baseline gap-2">
                                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                                        {ipo.total_subscription ? `${ipo.total_subscription}x` : '—'}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={`text-[10px] capitalize ${
                                            ipo.status === 'open'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                : ipo.status === 'upcoming'
                                                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300'
                                                : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                        }`}
                                    >
                                        {ipo.status}
                                    </Badge>
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                                    {ipo.ipo_type?.toUpperCase()} Issue · {ipo.exchange || 'NSE/BSE'}
                                </p>
                            </div>

                            {/* Card 4: Bidding Schedule Window */}
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                                    Bidding Dates
                                </span>
                                <div className="mt-1.5 flex items-baseline gap-1">
                                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                                        {formatDateShort(ipo.open_date)} – {formatDateShort(ipo.close_date)}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                                    Listing: <span className="font-medium text-neutral-700 dark:text-neutral-300">{formatDateShort(ipo.listing_date)}</span>
                                </p>
                            </div>
                        </div>

                        {/* 2. Visual Horizontal Timeline Stepper */}
                        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs">
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-800">
                                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    IPO Timeline & Key Milestones
                                </span>
                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                                    Daily Hours: {ipo.bidding_hours || '10:00 AM - 5:00 PM'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative">
                                {/* Step 1: Bidding */}
                                <div className="p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/50">
                                    <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 mb-1">
                                        <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                        <span className="text-[11px] font-semibold uppercase">1. Bidding Window</span>
                                    </div>
                                    <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                        {formatDateShort(ipo.open_date)} to {formatDateShort(ipo.close_date)}
                                    </p>
                                    <span className="text-[10px] text-neutral-500 mt-0.5 block">
                                        UPI mandate 5:00 PM cutoff
                                    </span>
                                </div>

                                {/* Step 2: Allotment */}
                                <div className="p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/50">
                                    <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 mb-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        <span className="text-[11px] font-semibold uppercase">2. Allotment</span>
                                    </div>
                                    <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                        {formatDateShort(ipo.allotment_date)}
                                    </p>
                                    <span className="text-[10px] text-neutral-500 mt-0.5 block">
                                        Check on registrar portal
                                    </span>
                                </div>

                                {/* Step 3: Refund */}
                                <div className="p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/50">
                                    <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 mb-1">
                                        <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-[11px] font-semibold uppercase">3. Refunds / Unblock</span>
                                    </div>
                                    <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                        {formatDateShort(ipo.refund_date)}
                                    </p>
                                    <span className="text-[10px] text-neutral-500 mt-0.5 block">
                                        Bank mandate auto-revoked
                                    </span>
                                </div>

                                {/* Step 4: Listing & Settlement */}
                                <div className="p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/50">
                                    <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 mb-1">
                                        <TrendingUp className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                        <span className="text-[11px] font-semibold uppercase">4. Listing & Settlement</span>
                                    </div>
                                    <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                        {formatDateShort(ipo.listing_date)}
                                    </p>
                                    <span className="text-[10px] text-neutral-500 mt-0.5 block">
                                        Finalized on Listing + T+1
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. 2-Column Bento Layout (Low Scroll) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Left Column (7 cols): Full Specifications Table */}
                            <div className="lg:col-span-7 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs">
                                <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                        Issue Specifications & Parameters
                                    </h3>
                                    <span className="text-xs font-mono text-neutral-500">
                                        {ipo.isin ? `ISIN: ${ipo.isin}` : ''}
                                    </span>
                                </div>

                                <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">Issue Price Band</span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {ipo.price_band_min && ipo.price_band_max
                                                ? `₹${ipo.price_band_min} - ₹${ipo.price_band_max}`
                                                : ipo.issue_price
                                                ? `₹${ipo.issue_price}`
                                                : 'TBD'}
                                        </span>
                                    </div>

                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">Market Lot Size</span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {ipo.lot_size} Shares
                                        </span>
                                    </div>

                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">Min. Application Amount (1 Lot)</span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            ₹{(lotSize * priceBandMax).toLocaleString('en-IN')}
                                        </span>
                                    </div>

                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">Total Issue Size</span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {ipo.issue_size ? `₹${ipo.issue_size} Cr` : 'TBD'}
                                        </span>
                                    </div>

                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">Face Value</span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            ₹{ipo.face_value || '10'} per share
                                        </span>
                                    </div>

                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">Daily Bidding Window</span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {ipo.bidding_hours || '10:00 AM – 5:00 PM'}
                                        </span>
                                    </div>

                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">Mandate Expiry Date</span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {ipo.mandate_end_date || ipo.refund_date || 'TBD'}
                                        </span>
                                    </div>

                                    <div className="py-2.5 flex items-center justify-between">
                                        <span className="text-neutral-500">ISIN Code</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                                                {ipo.isin || '—'}
                                            </span>
                                            {ipo.isin && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(ipo.isin || '');
                                                        setCopiedIsin(true);
                                                        setTimeout(() => setCopiedIsin(false), 2000);
                                                    }}
                                                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                                    title="Copy ISIN"
                                                >
                                                    {copiedIsin ? (
                                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rates Section inside specs */}
                                    <div className="py-2.5 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/30 px-2 rounded">
                                        <span className="text-neutral-600 dark:text-neutral-300 font-medium">Offered User Rate</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {ipo.active_rate ? `₹${ipo.active_rate.published_rate} / app` : 'Not Set'}
                                        </span>
                                    </div>

                                    {isAdmin && (
                                        <div className="py-2.5 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/30 px-2 rounded">
                                            <span className="text-neutral-600 dark:text-neutral-300 font-medium">Trader Rate & Margin</span>
                                            <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                                                {ipo.active_rate ? `₹${ipo.active_rate.trader_rate}` : 'Not Set'}
                                                {ipo.active_rate && (
                                                    <span className="text-emerald-600 ml-1.5">
                                                        (Margin: ₹{ipo.active_rate.margin})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column (5 cols): Interactive Lot & Profit Calculator + Official Links */}
                            <div className="lg:col-span-5 space-y-4">
                                {/* Interactive Lot Calculator */}
                                <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs">
                                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-neutral-100 dark:border-neutral-800">
                                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                            <Calculator className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            Lot & Profit Estimator
                                        </h3>
                                        <span className="text-[11px] text-neutral-500">Live Breakdown</span>
                                    </div>

                                    {/* Quick Lot Selection Pills */}
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 block">
                                                Select Lots to Apply:
                                            </label>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {[1, 2, 5, 10].map((num) => (
                                                    <button
                                                        key={num}
                                                        type="button"
                                                        onClick={() => setCalculatorLots(num)}
                                                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                                            calculatorLots === num
                                                                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700'
                                                                : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                        }`}
                                                    >
                                                        {num} {num === 1 ? 'Lot' : 'Lots'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Financial Estimation Box */}
                                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 space-y-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-neutral-500">Shares Applied</span>
                                                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                                    {(calculatorLots * lotSize).toLocaleString('en-IN')} Shares
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-neutral-500">Capital Needed</span>
                                                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                                                    ₹{(calculatorLots * lotSize * priceBandMax).toLocaleString('en-IN')}
                                                </span>
                                            </div>

                                            <div className="flex justify-between pt-1 border-t border-neutral-200 dark:border-neutral-700">
                                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Est. Listing Gain (@ GMP)</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    +₹{(calculatorLots * lotSize * currentGmp).toLocaleString('en-IN')}
                                                </span>
                                            </div>

                                            {ipo.active_rate?.published_rate && (
                                                <div className="flex justify-between text-[11px] text-neutral-500 pt-0.5">
                                                    <span>Fixed Rate Payout</span>
                                                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                                        ₹{(calculatorLots * Number(ipo.active_rate.published_rate)).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Direct Action Button */}
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setBatchCount(String(calculatorLots));
                                                setIsBatchModalOpen(true);
                                            }}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
                                        >
                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                            Apply for {calculatorLots} {calculatorLots === 1 ? 'Lot' : 'Lots'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Registrar & Official Documents Card */}
                                {(ipo.registrar_info || ipo.drhp_url || ipo.rhp_url) && (
                                    <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 p-4 shadow-xs space-y-3">
                                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                                            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                                Registrar & Prospectus
                                            </h3>
                                        </div>

                                        {/* Registrar Name & Contact */}
                                        {ipo.registrar_info && (
                                            <div className="text-xs space-y-1">
                                                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                                                    {ipo.registrar_info.name || 'Not Available'}
                                                </p>
                                                {ipo.registrar_info.contact_number && (
                                                    <p className="text-neutral-500">
                                                        Phone: <span className="text-neutral-800 dark:text-neutral-200">{ipo.registrar_info.contact_number}</span>
                                                    </p>
                                                )}
                                                {ipo.registrar_info.email && (
                                                    <p className="text-neutral-500">
                                                        Email: <a href={`mailto:${ipo.registrar_info.email}`} className="text-blue-600 hover:underline">{ipo.registrar_info.email}</a>
                                                    </p>
                                                )}
                                                {ipo.registrar_info.website && (
                                                    <a
                                                        href={ipo.registrar_info.website}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium pt-1"
                                                    >
                                                        Registrar Allotment Portal <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {/* Prospectus Buttons */}
                                        <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                                            {ipo.drhp_url && (
                                                <a
                                                    href={ipo.drhp_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[11px] font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                                >
                                                    <FileText className="h-3 w-3 text-neutral-500" />
                                                    DRHP Prospectus <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                                </a>
                                            )}
                                            {ipo.rhp_url && (
                                                <a
                                                    href={ipo.rhp_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                >
                                                    <FileText className="h-3 w-3 text-blue-500" />
                                                    RHP Prospectus <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB B: APPLICATIONS */}
                {activeTab === 'applications' && (() => {
                    const pendingBatchesCount = batches.filter(
                        (b) => b.application_status === 'pending_approval' || b.application_status === 'submitted'
                    ).length;

                    return (
                        <Card>
                            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
                                <div>
                                    <CardTitle className="text-base font-semibold">IPO Applications & Tracking</CardTitle>
                                    <CardDescription>Applications filled with dynamic profit sharing, bank accounts, and 1-click allotment actions</CardDescription>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* CSV Export Option 1: User Rates CSV */}
                                    <a
                                        href={`/ipos/${ipo.id}/export/user-csv`}
                                        download
                                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 shadow-2xs transition-colors"
                                        title="Export CSV with Serial No, PAN Holder, PAN, and User Applied Rate"
                                    >
                                        <Download className="h-3.5 w-3.5 text-blue-600" />
                                        User Rates CSV
                                    </a>

                                    {/* CSV Export Option 2: Trader Rates CSV (Admin only) */}
                                    {isAdmin && (
                                        <a
                                            href={`/ipos/${ipo.id}/export/trader-csv`}
                                            download
                                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 shadow-2xs transition-colors"
                                            title="Export CSV with Serial No, PAN Holder, PAN, and Trader Rate"
                                        >
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600" />
                                            Trader Rates CSV
                                        </a>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsBankModalOpen(true)}
                                        className="text-xs h-8"
                                    >
                                        <Landmark className="mr-1.5 h-3.5 w-3.5 text-neutral-500" />
                                        Bank Accounts ({bankAccounts.length})
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => setIsBatchModalOpen(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                                    >
                                        <Plus className="mr-1.5 h-3.5 w-3.5" /> + Fill Application
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Pending Approval Alert Banner for Admin */}
                                {pendingBatchesCount > 0 && isAdmin && (
                                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow">
                                                <Clock className="h-5 w-5 animate-pulse" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                                    {pendingBatchesCount} Application{pendingBatchesCount > 1 ? 's' : ''} Awaiting Approval
                                                    <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                                                        Auto-Approve: OFF
                                                    </Badge>
                                                </h3>
                                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                                    Auto-approval is turned OFF. Review each applicant below or approve all with 1-click.
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={handleApproveAll}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs shrink-0"
                                        >
                                            <Check className="mr-1.5 h-3.5 w-3.5" /> Approve All ({pendingBatchesCount})
                                        </Button>
                                    </div>
                                )}

                                {batches.length === 0 ? (
                                    <div className="py-12 text-center space-y-3">
                                        <p className="text-sm text-neutral-500">
                                            No applications recorded for {ipo.company_name} yet.
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={() => setIsBatchModalOpen(true)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            <Plus className="mr-1.5 h-4 w-4" /> Fill First Application
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-neutral-200 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800">
                                                <tr>
                                                    <th className="py-3 px-3">Applicant & Batch</th>
                                                    <th className="py-3 px-3">Bank</th>
                                                    <th className="py-3 px-3">PAN & UPI</th>
                                                    <th className="py-3 px-3">IPO Amount</th>
                                                    <th className="py-3 px-3">Current GMP</th>
                                                    <th className="py-3 px-3">Profit Sharing</th>
                                                    <th className="py-3 px-3">Est. Payout / Net</th>
                                                    <th className="py-3 px-3">Status</th>
                                                    <th className="py-3 px-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                                {batches.map((batch) => {
                                                    const pans = batch.batch_pans || [];
                                                    const panNumberRaw = batch.pan_number || (pans[0]?.pan_number_snapshot ?? '');
                                                    const panDisplay = panNumberRaw
                                                        ? (isAdmin ? panNumberRaw : `XXXXXX${panNumberRaw.slice(-4)}`)
                                                        : 'No PAN';

                                                    const locallyChecked = checkedBatchIds[batch.id];
                                                    const hasAutoCheckResult = Boolean(
                                                        batch.allotment_details ||
                                                        batch.allotment_checked_at ||
                                                        locallyChecked
                                                    );

                                                    const isAllotted = batch.application_status === 'allotted' || (hasAutoCheckResult && (batch.allotment_details?.allotted || locallyChecked?.allotted));
                                                    const isNotAllotted = batch.application_status === 'not_allotted' || (hasAutoCheckResult && (!batch.allotment_details?.allotted && !locallyChecked?.allotted));
                                                    const isPendingApproval = batch.application_status === 'pending_approval' || batch.application_status === 'submitted';
                                                    const isPending = !isAllotted && !isNotAllotted && batch.application_status !== 'cancelled' && !isPendingApproval && !hasAutoCheckResult;

                                                const appAmount = Number(batch.ipo_amount || batch.capital_amount || 0);

                                                const hasAllotmentDate = Boolean(batch.ipo?.allotment_date || ipo.allotment_date);
                                                const allotmentDateStr = (batch.ipo?.allotment_date || ipo.allotment_date)?.split('T')[0] ?? null;
                                                const isAllotmentDateReached = Boolean(allotmentDateStr && todayIst >= allotmentDateStr);
                                                const isBatchAllotmentToday = Boolean(allotmentDateStr && allotmentDateStr === todayIst);
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
                                                            isBatchAllotmentToday
                                                                ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                                                                : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50'
                                                        }`}
                                                    >
                                                        <td className="py-3 px-3">
                                                            <span className="font-semibold block text-neutral-900 dark:text-neutral-100">
                                                                {batch.applicant_name || batch.user?.name || 'Applicant'}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                <span className="font-mono text-[11px] text-neutral-400">
                                                                    {batch.batch_number} · {batch.funding_source === 'my_money' ? 'My Capital' : 'User Capital'}
                                                                </span>
                                                                {isBatchAllotmentToday ? (
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
                                                        <td className="py-3 px-3">
                                                            {batch.bank_name ? (
                                                                <span className="inline-flex items-center gap-1 font-medium text-xs text-neutral-700 dark:text-neutral-300">
                                                                    <Landmark className="h-3.5 w-3.5 text-blue-500" />
                                                                    {batch.bank_name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-neutral-400">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-neutral-800 dark:text-neutral-200">
                                                                <span>{panDisplay}</span>
                                                                {isAdmin && panNumberRaw && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => copyPan(panNumberRaw)}
                                                                        className="text-neutral-400 hover:text-blue-600 transition-colors"
                                                                        title="Copy unmasked PAN"
                                                                    >
                                                                        {copiedPan === panNumberRaw ? (
                                                                            <CheckCheck className="h-3 w-3 text-emerald-600" />
                                                                        ) : (
                                                                            <Copy className="h-3 w-3" />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {batch.upi_id ? (
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 block truncate max-w-[130px]" title={batch.upi_id}>
                                                                        {batch.upi_id}
                                                                    </span>
                                                                    {batch.upi_app && (
                                                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border font-medium ${getUpiAppBadgeClass(batch.upi_app)}`}>
                                                                            {batch.upi_app}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[11px] text-neutral-400 block">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                                                {formatInr(appAmount)}
                                                            </span>
                                                            <span className="text-[11px] text-neutral-400 block">
                                                                {batch.application_count} lot(s) ({batch.application_count * (ipo.lot_size || 1)} sh)
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 font-semibold text-emerald-600">
                                                            ₹{batch.gmp_snapshot || ipo.gmp || 0}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            {batch.profit_sharing_type === 'percentage' ? (
                                                                <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200">
                                                                    {batch.profit_sharing_value}% of Listing Gain
                                                                </Badge>
                                                            ) : batch.profit_sharing_type === 'fix' ? (
                                                                <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200">
                                                                    Fixed ₹{batch.profit_sharing_value || batch.expected_user_payout}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    Rate ₹{batch.published_rate_snapshot}
                                                                </Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <span className="font-medium text-emerald-600 dark:text-emerald-400 block">
                                                                {isAdmin ? 'Payout: ' : 'Your Payout: '}
                                                                {formatInr(isAllotted ? (batch.settled_user_payout ?? batch.expected_user_payout) : isNotAllotted ? 0 : batch.expected_user_payout)}
                                                            </span>
                                                            {isAdmin && (
                                                                <span className="text-[11px] text-neutral-400 block">
                                                                    Admin Net: {formatInr(isAllotted ? (batch.settled_net_earnings ?? batch.expected_net_earnings) : isNotAllotted ? 0 : batch.expected_net_earnings)}
                                                                </span>
                                                            )}
                                                            {!isAdmin && isPending && (
                                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 block">
                                                                    Finalized Listing + T+1
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3">
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
                                                                    {isAllotted ? 'Allotted' : isNotAllotted ? 'Not Allotted' : isPendingApproval ? 'Pending Approval' : (batch.application_status.replace('_', ' '))}
                                                                </Badge>

                                                                {/* KFintech Scraped Info */}
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
                                                        <td className="py-3 px-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                                {/* Approval controls for admin */}
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

                                                                {/* KFintech Allotment Check Button (Only visible when allotment date is present and reached) */}
                                                                {showAllotmentButton && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant={isBatchAllotmentToday ? 'default' : 'outline'}
                                                                        onClick={() => handleCheckAllotment(batch)}
                                                                        className={`h-7 px-2.5 text-xs font-semibold ${
                                                                            isBatchAllotmentToday
                                                                                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm ring-1 ring-sky-400'
                                                                                : 'border-sky-400 text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/50'
                                                                        }`}
                                                                        title={isBatchAllotmentToday ? 'Today is Allotment Day! Live query KFintech' : `Check KFintech allotment status (Allotment: ${formatIstDate(allotmentDateStr)})`}
                                                                    >
                                                                        <Search className={`h-3 w-3 mr-1 ${isBatchAllotmentToday ? 'text-white' : 'text-sky-600'}`} /> Check Allotment
                                                                    </Button>
                                                                )}

                                                                {isPending && (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => handleStatusChange(batch.id, 'allotted')}
                                                                            className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                                                            title="Mark Allotted (Auto-records profit & returns capital)"
                                                                        >
                                                                            <Check className="h-3 w-3 mr-1" /> Allotted
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => handleStatusChange(batch.id, 'not_allotted')}
                                                                            className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800"
                                                                            title="Mark Not Allotted (Refunds capital with ₹0 profit)"
                                                                        >
                                                                            <X className="h-3 w-3 mr-1" /> Not Allotted
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                {isAllotted && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Allotted
                                                                        </span>
                                                                        {!hasAutoCheckResult && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="h-6 px-1.5 text-[10px] text-neutral-400 hover:text-neutral-600"
                                                                                onClick={() => handleStatusChange(batch.id, 'ready')}
                                                                                title="Re-open status"
                                                                            >
                                                                                Undo
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {isNotAllotted && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800">
                                                                            <X className="h-3.5 w-3.5 mr-1 text-rose-600" /> Not Allotted
                                                                        </span>
                                                                        {!hasAutoCheckResult && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="h-6 px-1.5 text-[10px] text-neutral-400 hover:text-neutral-600"
                                                                                onClick={() => handleStatusChange(batch.id, 'ready')}
                                                                                title="Re-open status"
                                                                            >
                                                                                Undo
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {isAdmin && batch.settlement_status !== 'settled' && !isPending && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-xs border-emerald-600 text-emerald-600 ml-1"
                                                                        onClick={() => openSettlementModal(batch)}
                                                                    >
                                                                        Adjust
                                                                    </Button>
                                                                )}

                                                                {/* Delete Application Button */}
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
                );
            })()}

                {/* TAB C: RATES & HISTORY */}
                {activeTab === 'rates' && (
                    <div className="space-y-6">
                        {/* Active Rate Card */}
                        <Card className="border-emerald-500/30">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div>
                                    <CardTitle className="text-base font-semibold">Active Rate Configuration</CardTitle>
                                    <CardDescription>Applied to all new applications submitted</CardDescription>
                                </div>
                                {isAdmin && (
                                    <Button
                                        size="sm"
                                        onClick={() => setIsRateModalOpen(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        Configure New Rate
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {ipo.active_rate ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 p-4 border border-emerald-100 dark:border-emerald-900/50">
                                        <div>
                                            <span className="text-xs text-neutral-500 block">Published User Rate</span>
                                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                                ₹{ipo.active_rate.published_rate}
                                            </span>
                                            <span className="text-xs text-neutral-500 block mt-0.5">Offered to friends</span>
                                        </div>

                                        {isAdmin && (
                                            <>
                                                <div>
                                                    <span className="text-xs text-neutral-500 block">External Trader Rate</span>
                                                    <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                                        ₹{ipo.active_rate.trader_rate}
                                                    </span>
                                                    <span className="text-xs text-neutral-500 block mt-0.5">Commercial secret rate</span>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-neutral-500 block">Configured Margin</span>
                                                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                        ₹{ipo.active_rate.margin}
                                                    </span>
                                                    <span className="text-xs text-neutral-500 block mt-0.5">Trader rate − User rate</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <p className="py-4 text-sm text-neutral-500">No active rate set for this IPO yet.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Rate History Timeline */}
                        {isAdmin && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold">Rate Change Audit Trail</CardTitle>
                                    <CardDescription>
                                        Immutable record of all previous rate adjustments. Existing batches preserve historical rates.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!ipo.rates || ipo.rates.length === 0 ? (
                                        <p className="py-4 text-sm text-neutral-500">No historical rate changes recorded.</p>
                                    ) : (
                                        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                            {ipo.rates.map((rate) => (
                                                <div key={rate.id} className="py-3 flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm">
                                                                Published: ₹{rate.published_rate} · Trader: ₹{rate.trader_rate}
                                                            </span>
                                                            <Badge variant={rate.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                                                {rate.is_active ? 'Active' : 'Archived'}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-xs text-neutral-500 mt-0.5 block">
                                                            Margin: ₹{rate.margin} · Changed by {rate.creator?.name || 'Admin'} on {new Date(rate.created_at).toLocaleString()}
                                                        </span>
                                                        {rate.note && (
                                                            <p className="text-xs italic text-neutral-600 dark:text-neutral-400 mt-1">
                                                                Note: "{rate.note}"
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* TAB D: FUNDING & PROFIT (Admin Only) */}
                {activeTab === 'funding' && isAdmin && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* My Money Card */}
                            <Card className="border-l-4 border-l-blue-500">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-semibold">My Money Funded</CardTitle>
                                        <Badge>Admin Capital</Badge>
                                    </div>
                                    <CardDescription>Applications where I deploy the capital</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                                        <span className="text-neutral-500">Applications Count</span>
                                        <span className="font-semibold">{financials.my_money.applications}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                                        <span className="text-neutral-500">Capital Deployed</span>
                                        <span className="font-semibold">{formatInr(financials.my_money.capital_deployed)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                                        <span className="text-neutral-500">Expected Gross Proceeds</span>
                                        <span className="font-semibold">{formatInr(financials.my_money.expected_gross_profit)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                                        <span className="text-neutral-500">Agreed User Payout</span>
                                        <span className="font-semibold">{formatInr(financials.my_money.expected_user_payout)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800 text-emerald-600 font-semibold">
                                        <span>Expected Net Earnings</span>
                                        <span>{formatInr(financials.my_money.expected_net_earnings)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 font-bold text-neutral-900 dark:text-neutral-100">
                                        <span>Realized Net Earnings</span>
                                        <span>{formatInr(financials.my_money.realized_net_earnings)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* User Money Card */}
                            <Card className="border-l-4 border-l-purple-500">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-semibold">User Money Funded</CardTitle>
                                        <Badge variant="secondary">User Capital</Badge>
                                    </div>
                                    <CardDescription>Applications funded directly by users</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                                        <span className="text-neutral-500">Applications Count</span>
                                        <span className="font-semibold">{financials.user_money.applications}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                                        <span className="text-neutral-500">User Capital Recorded</span>
                                        <span className="font-semibold">{formatInr(financials.user_money.capital_recorded)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                                        <span className="text-neutral-500">Expected Gross Profit</span>
                                        <span className="font-semibold">{formatInr(financials.user_money.expected_gross_profit)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800 text-emerald-600 font-semibold">
                                        <span>Expected Net Margin</span>
                                        <span>{formatInr(financials.user_money.expected_net_earnings)}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 font-bold text-neutral-900 dark:text-neutral-100">
                                        <span>Realized Net Earnings</span>
                                        <span>{formatInr(financials.user_money.realized_net_earnings)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* TAB E: EXPORTS */}
                {activeTab === 'exports' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Trader PAN Export */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                    <CardTitle className="text-base font-semibold">Trader PAN Submission Sheet</CardTitle>
                                </div>
                                <CardDescription>
                                    Export PAN details, applicant names, application count, and notes formatted for external trader submission.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50">
                                    <strong>Commercial Privacy Protected:</strong> Private trader rates, margins, and internal earnings are strictly omitted from this file.
                                </div>

                                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                    <a href={`/ipos/${ipo.id}/export/trader`} download>
                                        <Download className="mr-2 h-4 w-4" /> Download Trader Submission CSV
                                    </a>
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Admin Financial Report */}
                        {isAdmin && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="h-5 w-5 text-blue-600" />
                                        <CardTitle className="text-base font-semibold">Financial & Margin Audit Report</CardTitle>
                                    </div>
                                    <CardDescription>
                                        Complete financial ledger containing trader rates, user rates, margins, capital deployed, and realized settlements.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900/50">
                                        <strong>Admin Confidential:</strong> Contains sensitive margin numbers. Do not share with regular users or traders.
                                    </div>

                                    <Button asChild variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                                        <a href={`/ipos/${ipo.id}/export/financials`} download>
                                            <Download className="mr-2 h-4 w-4" /> Download Complete Financials CSV
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL: Update GMP */}
            <Dialog open={isGmpModalOpen} onOpenChange={setIsGmpModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                            Update Grey Market Premium (GMP)
                        </DialogTitle>
                        <DialogDescription>
                            Official broker APIs (Upstox) do not publish unofficial grey market rates under SEBI regulations. Set the live GMP for {ipo.company_name} here to calculate estimated gains across applications.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleGmpSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="gmp_amount">Grey Market Premium (₹ per share) *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm font-semibold text-neutral-400">₹</span>
                                <Input
                                    id="gmp_amount"
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 25 or 0"
                                    value={gmpInput}
                                    onChange={(e) => setGmpInput(e.target.value)}
                                    className="pl-7 font-semibold"
                                    autoFocus
                                />
                            </div>
                            {gmpInput !== '' && priceBandMax > 0 && (
                                <p className="text-xs text-emerald-600 font-medium pt-1">
                                    Estimated Listing Gain: +{((Number(gmpInput) / priceBandMax) * 100).toFixed(1)}% (₹{(Number(gmpInput) * (ipo.lot_size || 1)).toLocaleString('en-IN')} / lot)
                                </p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsGmpModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                                Save GMP
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 1: Configure Rates (Admin) */}
            <Dialog open={isRateModalOpen} onOpenChange={setIsRateModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configure Rates for {ipo.company_name}</DialogTitle>
                        <DialogDescription>
                            Set the private trader rate and the rate offered to your friends.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleRateSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="trader_rate">External Trader Rate (₹) *</Label>
                            <Input
                                id="trader_rate"
                                type="number"
                                step="0.01"
                                required
                                placeholder="e.g. 1000"
                                value={traderRateInput}
                                onChange={(e) => setTraderRateInput(e.target.value)}
                            />
                            <span className="text-[11px] text-neutral-500">Private rate quoted to you by your trader</span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="published_rate">Published User Rate (₹) *</Label>
                            <Input
                                id="published_rate"
                                type="number"
                                step="0.01"
                                required
                                placeholder="e.g. 800"
                                value={publishedRateInput}
                                onChange={(e) => setPublishedRateInput(e.target.value)}
                            />
                            <span className="text-[11px] text-neutral-500">Rate visible and offered to your friends</span>
                        </div>

                        {/* Live Margin Preview */}
                        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-3 text-sm">
                            <span className="text-xs text-neutral-500 block">Calculated Margin</span>
                            <span className="text-lg font-bold text-emerald-600">
                                ₹{Number(traderRateInput || 0) - Number(publishedRateInput || 0)} / application
                            </span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="rate_note">Change Note</Label>
                            <Input
                                id="rate_note"
                                placeholder="Reason for rate update..."
                                value={rateNoteInput}
                                onChange={(e) => setRateNoteInput(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsRateModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Save & Activate Rate
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 2: Record / Fill Application */}
            <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isAdmin ? 'Record IPO Application' : `Apply for ${ipo.company_name}`}</DialogTitle>
                        <DialogDescription>
                            {isAdmin
                                ? `Record an application for ${ipo.company_name} with flexible profit sharing and bank account details.`
                                : `Submit your application for ${ipo.company_name}. Payouts are finalized on Listing Day + T+1.`}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Mode Selector: Single Application vs Bulk Apply */}
                    <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800/80 p-1 my-1">
                        <button
                            type="button"
                            onClick={() => setApplyMode('single')}
                            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                                applyMode === 'single'
                                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                            }`}
                        >
                            Single Application
                        </button>
                        <button
                            type="button"
                            onClick={() => setApplyMode('bulk')}
                            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                                applyMode === 'bulk'
                                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                            }`}
                        >
                            <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Bulk Apply (Saved PANs)</span>
                            {userPans.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {userPans.length}
                                </Badge>
                            )}
                        </button>
                    </div>

                    <form onSubmit={handleBatchSubmit} className="space-y-4 pt-1">
                        {applyMode === 'bulk' ? (
                            <div className="space-y-4">
                                {isAdmin && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="bulk_user_filter">Filter PANs by Friend / User</Label>
                                            <Select value={bulkUserFilter} onValueChange={setBulkUserFilter}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="All Friends / Users" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Friends / Saved PANs ({userPans.length})</SelectItem>
                                                    {usersList.map((u) => {
                                                        const userPanCount = userPans.filter((p) => String(p.user_id) === String(u.id)).length;
                                                        return (
                                                            <SelectItem key={u.id} value={String(u.id)}>
                                                                {u.name} ({userPanCount} PAN{userPanCount !== 1 ? 's' : ''})
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="bulk_funding_source">Funding Capital Source *</Label>
                                            <Select
                                                value={batchFunding}
                                                onValueChange={(val: 'my_money' | 'user_money') => setBatchFunding(val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="my_money">My Money (Admin Funds Capital)</SelectItem>
                                                    <SelectItem value="user_money">User Money (Applicant Funds)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {/* Bulk PAN Selector Box */}
                                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-3 space-y-2.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                                                Select Saved PAN Cards *
                                            </Label>
                                            <Badge variant={selectedBulkPanIds.length > 0 ? "default" : "outline"} className={`text-[10px] px-1.5 py-0 h-4 ${selectedBulkPanIds.length > 0 ? 'bg-emerald-600 text-white' : ''}`}>
                                                {selectedBulkPanIds.length} of {filteredBulkPans.length} Selected
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={toggleSelectAllBulkPans}
                                                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                                            >
                                                {filteredBulkPans.length > 0 && filteredBulkPans.every((p) => selectedBulkPanIds.includes(p.id))
                                                    ? 'Deselect All'
                                                    : `Select All (${filteredBulkPans.length})`}
                                            </button>
                                            {selectedBulkPanIds.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedBulkPanIds([])}
                                                    className="text-[11px] text-neutral-400 hover:text-neutral-600 hover:underline"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Search input for PAN list */}
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                                        <Input
                                            placeholder="Search by name, PAN, broker..."
                                            value={bulkPanSearchQuery}
                                            onChange={(e) => setBulkPanSearchQuery(e.target.value)}
                                            className="h-8 pl-8 text-xs bg-white dark:bg-neutral-900"
                                        />
                                    </div>

                                    {/* Scrollable list of selectable PAN cards */}
                                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                                        {filteredBulkPans.length === 0 ? (
                                            <div className="py-6 px-3 text-center text-xs text-neutral-400 bg-white dark:bg-neutral-900 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800">
                                                No saved PAN cards found.
                                                <div className="mt-1 text-[11px] text-neutral-500">
                                                    Add PAN cards first from My PANs or switch to Single Application.
                                                </div>
                                            </div>
                                        ) : (
                                            filteredBulkPans.map((p) => {
                                                const isSelected = selectedBulkPanIds.includes(p.id);
                                                return (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => toggleBulkPanId(p.id)}
                                                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                                                            isSelected
                                                                ? 'bg-blue-50/70 border-blue-300 dark:bg-blue-950/40 dark:border-blue-700/80 shadow-xs'
                                                                : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border transition ${
                                                                isSelected
                                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                                    : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                                                            }`}>
                                                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                                                        {isAdmin ? p.pan_number : p.masked_pan}
                                                                    </span>
                                                                    {p.broker_name && (
                                                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-neutral-200 text-neutral-500">
                                                                            {p.broker_name}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {p.account_holder_name && (
                                                                    <span className="text-[11px] text-neutral-500 block truncate">
                                                                        {p.account_holder_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {isAdmin && p.user?.name && (
                                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-neutral-300 text-neutral-600 shrink-0">
                                                                {p.user.name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Bank Account & UPI ID for Mandate / Payout */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="bulk_bank_name">Payout / Mandate Bank Account</Label>
                                        <Select value={bankName} onValueChange={setBankName}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select primary bank..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {bankAccounts.length === 0 ? (
                                                    <SelectItem value="none" disabled>
                                                        No saved banks
                                                    </SelectItem>
                                                ) : (
                                                    bankAccounts.map((b) => (
                                                        <SelectItem key={b.id} value={b.bank_name}>
                                                            {b.bank_name} {b.upis && b.upis.length > 0 ? `(${b.upis.length} UPI)` : ''}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="bulk_upi_id">Mandate UPI ID (Optional)</Label>
                                        <Input
                                            id="bulk_upi_id"
                                            placeholder="e.g. name@oksbi"
                                            value={upiId}
                                            onChange={(e) => {
                                                setUpiId(e.target.value);
                                                setUpiApp(detectUpiApp(e.target.value));
                                            }}
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {isAdmin && (
                                    <div className="space-y-1">
                                        <Label htmlFor="user_id">Select Friend / User</Label>
                                        <Select value={batchUserId} onValueChange={setBatchUserId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Choose user..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {usersList.map((u) => (
                                                    <SelectItem key={u.id} value={String(u.id)}>
                                                        {u.name} ({u.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                        {/* Applicant Name & Bank */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="applicant_name">Applicant Name *</Label>
                                <Input
                                    id="applicant_name"
                                    required
                                    placeholder="e.g. Rahul Sharma"
                                    value={applicantName}
                                    onChange={(e) => setApplicantName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="bank_name">Bank Account</Label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingNewBank(!isAddingNewBank)}
                                            className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                                        >
                                            <Plus className="h-3 w-3" />
                                            {isAddingNewBank ? 'Select Existing' : 'New Bank'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsBankModalOpen(true)}
                                            className="text-[11px] text-neutral-500 hover:underline flex items-center gap-0.5"
                                            title="Manage Bank Accounts and UPI IDs"
                                        >
                                            <Settings className="h-3 w-3" />
                                            Manage
                                        </button>
                                    </div>
                                </div>

                                {isAddingNewBank ? (
                                    <div className="flex gap-1.5">
                                        <Input
                                            placeholder="Type bank name (e.g. HDFC Bank)"
                                            value={inlineBankName}
                                            onChange={(e) => setInlineBankName(e.target.value)}
                                            className="h-9 text-xs"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-9 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                                            onClick={() => handleSaveBank(inlineBankName)}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Select value={bankName} onValueChange={setBankName}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select or type bank..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {bankAccounts.length === 0 ? (
                                                    <SelectItem value="none" disabled>
                                                        No saved banks. Click 'New Bank' above.
                                                    </SelectItem>
                                                ) : (
                                                    bankAccounts.map((b) => (
                                                        <SelectItem key={b.id} value={b.bank_name}>
                                                            {b.bank_name} {b.upis && b.upis.length > 0 ? `(${b.upis.length} UPI)` : ''}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>

                                        {/* Linked UPI Quick Pills for selected bank */}
                                        {(() => {
                                            const currentBank = bankAccounts.find((b) => b.bank_name === bankName);
                                            if (currentBank?.upis && currentBank.upis.length > 0) {
                                                return (
                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                        <span className="text-[10px] text-neutral-400">Linked UPI:</span>
                                                        {currentBank.upis.map((u) => (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setUpiId(u.upi_id);
                                                                    setUpiApp(u.upi_app || detectUpiApp(u.upi_id));
                                                                    setIsAddingNewUpi(false);
                                                                }}
                                                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                                                                    upiId === u.upi_id
                                                                        ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700 font-semibold'
                                                                        : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'
                                                                }`}
                                                            >
                                                                <Smartphone className="h-2.5 w-2.5" />
                                                                {u.upi_id}
                                                                {u.upi_app && <span className="text-[9px] opacity-75">({u.upi_app})</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* PAN & UPI */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="pan_number">PAN Number</Label>
                                    <div className="flex items-center gap-2">
                                        {userPans.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAddingNewPan(!isAddingNewPan);
                                                    setIsPanDropdownOpen(false);
                                                    if (!isAddingNewPan) {
                                                        setPanNumber('');
                                                        setBatchPanId('');
                                                    }
                                                }}
                                                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400 font-medium"
                                            >
                                                {isAddingNewPan ? 'Select Saved PAN' : '+ Type New PAN'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {!isAddingNewPan && userPans.length > 0 ? (
                                    <div className="relative">
                                        {/* Searchable Combobox Trigger */}
                                        <button
                                            type="button"
                                            onClick={() => setIsPanDropdownOpen(!isPanDropdownOpen)}
                                            className="w-full flex items-center justify-between h-9 px-3 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition"
                                        >
                                            {panNumber ? (
                                                <div className="flex items-center gap-1.5 truncate text-left">
                                                    <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                                                        {isAdmin ? panNumber : `XXXXXX${panNumber.slice(-4)}`}
                                                    </span>
                                                    {(() => {
                                                        const matched = userPans.find((p) => p.pan_number === panNumber);
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
                                            <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 shrink-0 ml-1 transition-transform ${isPanDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Popover Dropdown Menu */}
                                        {isPanDropdownOpen && (
                                            <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-2 space-y-1.5">
                                                {/* Search Input */}
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                                                    <Input
                                                        placeholder="Search PAN, name, broker..."
                                                        value={panSearchQuery}
                                                        onChange={(e) => setPanSearchQuery(e.target.value)}
                                                        className="h-8 pl-8 text-xs font-normal"
                                                        autoFocus
                                                    />
                                                </div>

                                                {/* Filtered PAN list */}
                                                <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                                                    {filteredPans.length === 0 ? (
                                                        <div className="py-3 px-2 text-center text-xs text-neutral-400">
                                                            No saved PANs match "{panSearchQuery}".
                                                            {panSearchQuery.trim().length === 10 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPanNumber(panSearchQuery.trim().toUpperCase());
                                                                        setBatchPanId('');
                                                                        setIsPanDropdownOpen(false);
                                                                    }}
                                                                    className="block mx-auto mt-1.5 text-xs text-blue-600 hover:underline font-semibold"
                                                                >
                                                                    Use "{panSearchQuery.trim().toUpperCase()}"
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        filteredPans.map((p) => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => handleSelectSavedPan(p)}
                                                                className={`w-full text-left py-2 px-2.5 rounded-md text-xs flex items-center justify-between transition ${
                                                                    panNumber === p.pan_number
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

                                                {/* Bottom action to switch to typing */}
                                                <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center text-[11px]">
                                                    <span className="text-neutral-400">Total: {userPans.length} saved</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsAddingNewPan(true);
                                                            setIsPanDropdownOpen(false);
                                                            setPanNumber('');
                                                            setBatchPanId('');
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
                                    <div className="space-y-1">
                                        <Input
                                            id="pan_number"
                                            placeholder="e.g. ABCDE1234F"
                                            maxLength={10}
                                            value={panNumber}
                                            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                                            className="font-mono uppercase text-sm"
                                        />
                                        <p className="text-[10px] text-neutral-400">
                                            New PAN will be auto-saved and linked to this application.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="upi_id">UPI ID</Label>
                                    <div className="flex items-center gap-2">
                                        {userUpis.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsAddingNewUpi(!isAddingNewUpi)}
                                                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                                            >
                                                {isAddingNewUpi ? 'Select Saved UPI' : '+ New UPI ID'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {!isAddingNewUpi && userUpis.length > 0 ? (
                                    <div className="space-y-1">
                                        <Select
                                            value={upiId}
                                            onValueChange={(val) => {
                                                setUpiId(val);
                                                const selectedUpi = userUpis.find((u) => u.upi_id === val);
                                                if (selectedUpi) {
                                                    const app = selectedUpi.upi_app || detectUpiApp(val);
                                                    setUpiApp(app);
                                                    if (selectedUpi.bank_account?.bank_name) {
                                                        setBankName(selectedUpi.bank_account.bank_name);
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select saved UPI ID..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {userUpis.map((u) => (
                                                    <SelectItem key={u.id} value={u.upi_id}>
                                                        <span className="font-mono">{u.upi_id}</span>
                                                        <span className="text-xs text-neutral-500 ml-1.5">
                                                            • {u.upi_app} {u.bank_account ? `(${u.bank_account.bank_name})` : ''}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {upiId && (
                                            <div className="flex items-center justify-between text-xs text-neutral-500 pt-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span>UPI App:</span>
                                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border font-medium ${getUpiAppBadgeClass(upiApp)}`}>
                                                        {upiApp || detectUpiApp(upiId)}
                                                    </Badge>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAddingNewUpi(true)}
                                                    className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                                >
                                                    Use different ID
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <div className="flex gap-2">
                                            <Input
                                                id="upi_id"
                                                placeholder="e.g. rahul@oksbi or 9876543210@ybl"
                                                value={upiId}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setUpiId(val);
                                                    setUpiApp(detectUpiApp(val));
                                                }}
                                                className="font-mono text-sm"
                                            />
                                            <Select value={upiApp} onValueChange={setUpiApp}>
                                                <SelectTrigger className="w-[130px] shrink-0 text-xs">
                                                    <SelectValue placeholder="UPI App" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Auto">Auto Detect</SelectItem>
                                                    <SelectItem value="Google Pay">Google Pay</SelectItem>
                                                    <SelectItem value="PhonePe">PhonePe</SelectItem>
                                                    <SelectItem value="Paytm">Paytm</SelectItem>
                                                    <SelectItem value="BHIM">BHIM</SelectItem>
                                                    <SelectItem value="Cred">Cred</SelectItem>
                                                    <SelectItem value="Amazon Pay">Amazon Pay</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <p className="text-[10px] text-neutral-400">
                                            App auto-detects from handle. UPI ID will be auto-saved and linked to your bank.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Lots and Funding Source */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="application_count">Number of Lots / Applications *</Label>
                                <Input
                                    id="application_count"
                                    type="number"
                                    min="1"
                                    max="500"
                                    required
                                    value={batchCount}
                                    onChange={(e) => setBatchCount(e.target.value)}
                                />
                                <span className="text-[11px] text-neutral-400">
                                    {parsedBatchCount * lotSize} total shares ({lotSize} sh/lot)
                                </span>
                            </div>

                            {isAdmin ? (
                                <div className="space-y-1">
                                    <Label htmlFor="funding_source">Funding Capital Source *</Label>
                                    <Select
                                        value={batchFunding}
                                        onValueChange={(val: 'my_money' | 'user_money') => setBatchFunding(val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="my_money">My Money (Admin Funds Capital)</SelectItem>
                                            <SelectItem value="user_money">User Money (Applicant Funds)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Label>Funding Capital Source</Label>
                                    <div className="h-9 px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-800/60 text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                        <span>Self-Funded (via UPI Mandate)</span>
                                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30">Direct</Badge>
                                    </div>
                                    <span className="text-[10px] text-neutral-400">Blocked directly in your own bank account via UPI mandate</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Profit Sharing Model */}
                <div className="space-y-2 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                    Profit Sharing Model Decided
                                </Label>
                                {ipo.accept_fix_applications === false && !isAdmin && (
                                    <span className="text-[10px] text-rose-500 font-medium">
                                        Fixed rate disabled by admin
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    disabled={!isAdmin && ipo.accept_fix_applications === false}
                                    onClick={() => setProfitSharingType('fix')}
                                    className={`py-2 px-2.5 text-xs font-medium rounded-lg border text-center transition ${
                                        profitSharingType === 'fix'
                                            ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-semibold'
                                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed'
                                    }`}
                                >
                                    Fixed Amount (₹)
                                    {!isAdmin && ipo.accept_fix_applications === false && (
                                        <span className="block text-[9px] text-rose-500 font-normal">Closed</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProfitSharingType('percentage')}
                                    className={`py-2 px-2.5 text-xs font-medium rounded-lg border text-center transition ${
                                        profitSharingType === 'percentage'
                                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold'
                                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                                    }`}
                                >
                                    Percentage (%)
                                </button>
                                <button
                                    type="button"
                                    disabled={!ipo.active_rate}
                                    onClick={() => setProfitSharingType('rate_margin')}
                                    className={`py-2 px-2.5 text-xs font-medium rounded-lg border text-center transition ${
                                        profitSharingType === 'rate_margin'
                                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold'
                                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-40'
                                    }`}
                                >
                                    {isAdmin ? 'Fixed Rate Margin' : `Published Rate (₹${activePublishedRate})`}
                                </button>
                            </div>

                            {profitSharingType === 'fix' && (
                                <div className="space-y-1">
                                    <Label htmlFor="profit_sharing_value">Fixed Profit Share Payout (₹ per lot)</Label>
                                    <Input
                                        id="profit_sharing_value"
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="e.g. 500 or 1000"
                                        value={profitSharingValue}
                                        onChange={(e) => setProfitSharingValue(e.target.value)}
                                    />
                                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                                        <span>Applicant receives this fixed amount regardless of market fluctuation</span>
                                        {!isAdmin && ipo.auto_approve_fix === false && (
                                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                Requires Admin Approval
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {profitSharingType === 'percentage' && (
                                <div className="space-y-1">
                                    <Label htmlFor="profit_sharing_value">Percentage of Expected Listing Gain (%)</Label>
                                    <Input
                                        id="profit_sharing_value"
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        placeholder="e.g. 20 (for 20% sharing)"
                                        value={profitSharingValue}
                                        onChange={(e) => setProfitSharingValue(e.target.value)}
                                    />
                                    <span className="text-[11px] text-neutral-400">
                                        Calculated automatically from Current GMP: ₹{currentGmp}/share
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Auto-Calculated Metrics Card (From API & IPO) */}
                        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/60 p-3.5 border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
                                    Live Auto-Calculations
                                </span>
                                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-800 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Tentative (Subject to Allotment & Listing)
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                                <div className="rounded-lg bg-white dark:bg-neutral-800 p-2.5 border border-neutral-100 dark:border-neutral-700/60">
                                    <span className="text-[11px] text-neutral-400 block">Amount of IPO (Capital)</span>
                                    <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                                        {formatInr(calculatedIpoAmount)}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                                        {applyMode === 'bulk' ? selectedBulkPanIds.length : parsedBatchCount} lot{(applyMode === 'bulk' ? selectedBulkPanIds.length : parsedBatchCount) !== 1 ? 's' : ''} ({(applyMode === 'bulk' ? selectedBulkPanIds.length : parsedBatchCount) * lotSize} sh)
                                    </span>
                                </div>

                                <div className="rounded-lg bg-white dark:bg-neutral-800 p-2.5 border border-neutral-100 dark:border-neutral-700/60">
                                    <span className="text-[11px] text-neutral-400 block">Current GMP</span>
                                    <span className="text-sm font-bold text-emerald-600">
                                        ₹{currentGmp} / sh
                                    </span>
                                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                                        Unofficial grey market rate
                                    </span>
                                </div>

                                <div className="rounded-lg bg-white dark:bg-neutral-800 p-2.5 border border-neutral-100 dark:border-neutral-700/60">
                                    <span className="text-[11px] text-neutral-400 block">Est. Listing Gain</span>
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                        {formatInr(calculatedListingGain)}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                                        Tentative at current GMP
                                    </span>
                                </div>

                                <div className={`rounded-lg bg-white dark:bg-neutral-800 p-2.5 border border-neutral-100 dark:border-neutral-700/60 ${isAdmin ? '' : 'col-span-2 sm:col-span-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800'}`}>
                                    <span className="text-[11px] text-neutral-400 block">
                                        {isAdmin ? 'Applicant Payout' : 'Tentative Applicant Payout (Subject to Allotment & Listing)'}
                                    </span>
                                    <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatInr(previewUserPayout)}
                                    </span>
                                    {!isAdmin && (
                                        <span className="text-[10px] text-neutral-500 block mt-0.5">
                                            100% your earnings upon successful allotment & Listing Day + T+1 settlement
                                        </span>
                                    )}
                                </div>

                                {isAdmin && (
                                    <div className="rounded-lg bg-white dark:bg-neutral-800 p-2.5 border border-neutral-100 dark:border-neutral-700/60 col-span-2 sm:col-span-2">
                                        <span className="text-[11px] text-neutral-400 block">Admin Net Margin / Profit</span>
                                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                            {formatInr(previewNetEarnings)}
                                        </span>
                                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                                            Admin margin only (hidden from applicant)
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Settlement & Timeline Notice */}
                            <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <div className="space-y-0.5">
                                    <span className="font-semibold block text-amber-950 dark:text-amber-100">
                                        Tentative Earnings & Settlement Lifecycle
                                    </span>
                                    <span className="text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-300 block">
                                        All profit numbers shown above are tentative estimates based on current GMP / agreed rate. Final calculations and payouts are settled strictly on <strong>Listing Day + T+1 day</strong> once exchange trading concludes and allotment is confirmed.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="space-y-1">
                                <Label htmlFor="trader_ref">Trader Reference Number (Optional)</Label>
                                <Input
                                    id="trader_ref"
                                    placeholder="e.g. TR-99482"
                                    value={batchTraderRef}
                                    onChange={(e) => setBatchTraderRef(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label htmlFor="batch_notes">Notes (Optional)</Label>
                            <Input
                                id="batch_notes"
                                placeholder="Any specific remarks..."
                                value={batchNotes}
                                onChange={(e) => setBatchNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsBatchModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={applyMode === 'bulk' && selectedBulkPanIds.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            >
                                {applyMode === 'bulk'
                                    ? `Submit Bulk Applications (${selectedBulkPanIds.length} Lots)`
                                    : (isAdmin ? 'Record Application' : 'Submit Application')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 4: Manage Bank Accounts & UPI IDs */}
            <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Landmark className="h-5 w-5 text-blue-600" />
                            Manage Bank Accounts & UPI IDs
                        </DialogTitle>
                        <DialogDescription>
                            Save bank accounts and UPI IDs. Link UPI IDs to specific banks or keep them standalone.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Navigation tabs */}
                    <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-4 pt-1">
                        <button
                            type="button"
                            onClick={() => setBankModalTab('banks')}
                            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                                bankModalTab === 'banks'
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
                            }`}
                        >
                            <Landmark className="h-3.5 w-3.5" />
                            Bank Accounts ({bankAccounts.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setBankModalTab('upis')}
                            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                                bankModalTab === 'upis'
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
                            }`}
                        >
                            <Smartphone className="h-3.5 w-3.5" />
                            Saved UPI IDs ({userUpis.length})
                        </button>
                    </div>

                    {bankModalTab === 'banks' ? (
                        <div className="space-y-4 pt-2">
                            {/* Quick Add Bank Form */}
                            <form onSubmit={(e) => handleSaveBank(newBankName, e)} className="flex gap-2">
                                <Input
                                    required
                                    placeholder="Enter Bank Name (e.g. HDFC Bank, SBI)"
                                    value={newBankName}
                                    onChange={(e) => setNewBankName(e.target.value)}
                                    className="flex-1"
                                />
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                                    <Plus className="h-4 w-4 mr-1" /> Add Bank
                                </Button>
                            </form>

                            {/* Bank Accounts List with Linked UPI IDs */}
                            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800 max-h-[380px] overflow-y-auto">
                                {bankAccounts.length === 0 ? (
                                    <p className="py-8 text-center text-xs text-neutral-500">
                                        No bank accounts added yet. Enter a bank name above.
                                    </p>
                                ) : (
                                    bankAccounts.map((b) => (
                                        <div key={b.id} className="p-3.5 space-y-2 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Landmark className="h-4 w-4 text-blue-600 shrink-0" />
                                                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                        {b.bank_name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (inlineUpiBankId === b.id) {
                                                                setInlineUpiBankId(null);
                                                            } else {
                                                                setInlineUpiBankId(b.id);
                                                                setInlineUpiText('');
                                                                setInlineUpiApp('Auto');
                                                            }
                                                        }}
                                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                        Add UPI
                                                    </button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        onClick={() => handleDeleteBank(b.id)}
                                                        title="Delete bank"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Linked UPIs for this bank */}
                                            <div className="pl-6">
                                                {b.upis && b.upis.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {b.upis.map((u) => (
                                                            <div
                                                                key={u.id}
                                                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-xs"
                                                            >
                                                                <Smartphone className="h-3 w-3 text-neutral-400" />
                                                                <span className="font-mono text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
                                                                    {u.upi_id}
                                                                </span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-[9px] px-1 py-0 h-3.5 border ${getUpiAppBadgeClass(u.upi_app)}`}
                                                                >
                                                                    {u.upi_app}
                                                                </Badge>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteUpi(u.id)}
                                                                    className="text-neutral-400 hover:text-red-500 ml-0.5"
                                                                    title="Delete UPI ID"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-neutral-400">
                                                        No UPI IDs linked to this bank yet.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Inline Add UPI to this bank */}
                                            {inlineUpiBankId === b.id && (
                                                <div className="pl-6 pt-1 flex flex-wrap sm:flex-nowrap items-center gap-2">
                                                    <Input
                                                        placeholder="UPI ID (e.g. user@okhdfcbank)"
                                                        value={inlineUpiText}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setInlineUpiText(val);
                                                            setInlineUpiApp(detectUpiApp(val));
                                                        }}
                                                        className="h-8 text-xs font-mono flex-1 min-w-[150px]"
                                                    />
                                                    <Select value={inlineUpiApp} onValueChange={setInlineUpiApp}>
                                                        <SelectTrigger className="h-8 text-xs w-[120px] shrink-0">
                                                            <SelectValue placeholder="App" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Auto">Auto Detect</SelectItem>
                                                            <SelectItem value="Google Pay">Google Pay</SelectItem>
                                                            <SelectItem value="PhonePe">PhonePe</SelectItem>
                                                            <SelectItem value="Paytm">Paytm</SelectItem>
                                                            <SelectItem value="BHIM">BHIM</SelectItem>
                                                            <SelectItem value="Cred">Cred</SelectItem>
                                                            <SelectItem value="Amazon Pay">Amazon Pay</SelectItem>
                                                            <SelectItem value="Other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                                        onClick={() => {
                                                            handleSaveUpi(inlineUpiText, inlineUpiApp, b.id);
                                                            setInlineUpiBankId(null);
                                                            setInlineUpiText('');
                                                        }}
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-2 text-xs shrink-0"
                                                        onClick={() => setInlineUpiBankId(null)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 pt-2">
                            {/* Form to Add UPI ID and link to any bank */}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSaveUpi(newUpiId, newUpiApp, newUpiBankId, e);
                                }}
                                className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3"
                            >
                                <div className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                                    Add New UPI ID
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-neutral-400">UPI ID *</Label>
                                        <Input
                                            required
                                            placeholder="e.g. rahul@oksbi"
                                            value={newUpiId}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNewUpiId(val);
                                                setNewUpiApp(detectUpiApp(val));
                                            }}
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-neutral-400">UPI App</Label>
                                        <Select value={newUpiApp} onValueChange={setNewUpiApp}>
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Auto">Auto Detect</SelectItem>
                                                <SelectItem value="Google Pay">Google Pay</SelectItem>
                                                <SelectItem value="PhonePe">PhonePe</SelectItem>
                                                <SelectItem value="Paytm">Paytm</SelectItem>
                                                <SelectItem value="BHIM">BHIM</SelectItem>
                                                <SelectItem value="Cred">Cred</SelectItem>
                                                <SelectItem value="Amazon Pay">Amazon Pay</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-neutral-400">Link to Bank</Label>
                                        <Select value={newUpiBankId} onValueChange={setNewUpiBankId}>
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Select bank" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Bank (Standalone)</SelectItem>
                                                {bankAccounts.map((b) => (
                                                    <SelectItem key={b.id} value={String(b.id)}>
                                                        {b.bank_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Save UPI ID
                                    </Button>
                                </div>
                            </form>

                            {/* All Saved UPI IDs List */}
                            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-800 max-h-[300px] overflow-y-auto">
                                {userUpis.length === 0 ? (
                                    <p className="py-8 text-center text-xs text-neutral-500">
                                        No saved UPI IDs yet. Add one above.
                                    </p>
                                ) : (
                                    userUpis.map((u) => (
                                        <div key={u.id} className="p-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                                            <div className="flex items-center gap-2.5">
                                                <Smartphone className="h-4 w-4 text-purple-600 shrink-0" />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                                            {u.upi_id}
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[9px] px-1.5 py-0 h-4 border font-medium ${getUpiAppBadgeClass(u.upi_app)}`}
                                                        >
                                                            {u.upi_app}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                                                        <Landmark className="h-3 w-3 text-neutral-400" />
                                                        {u.bank_account ? (
                                                            <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                                                                Linked to {u.bank_account.bank_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-neutral-400">Standalone (No bank linked)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => handleDeleteUpi(u.id)}
                                                title="Delete UPI ID"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsBankModalOpen(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 3: Settlement Modal (Admin) */}
            <Dialog open={!!settlingBatch} onOpenChange={() => setSettlingBatch(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Settle Batch: {settlingBatch?.batch_number}</DialogTitle>
                        <DialogDescription>
                            Record actual gross profit and finalized payouts upon allotment or listing.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSettlementSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="actual_gross">Actual Gross (₹) *</Label>
                                <Input
                                    id="actual_gross"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={settleActualGross}
                                    onChange={(e) => setSettleActualGross(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="actual_payout">Actual User Payout (₹) *</Label>
                                <Input
                                    id="actual_payout"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={settleActualPayout}
                                    onChange={(e) => setSettleActualPayout(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="net_earnings">My Net Earnings (₹) *</Label>
                                <Input
                                    id="net_earnings"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={settleNetEarnings}
                                    onChange={(e) => setSettleNetEarnings(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="capital_returned">Capital Returned (₹) *</Label>
                                <Input
                                    id="capital_returned"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={settleCapitalReturned}
                                    onChange={(e) => setSettleCapitalReturned(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="settle_date">Settlement Date *</Label>
                            <Input
                                id="settle_date"
                                type="date"
                                required
                                value={settleDate}
                                onChange={(e) => setSettleDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="settle_notes">Settlement Notes</Label>
                            <Input
                                id="settle_notes"
                                placeholder="Adjustment details..."
                                value={settleNotes}
                                onChange={(e) => setSettleNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setSettlingBatch(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Confirm Settlement
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
                companyName={ipo.company_name}
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
                            <strong>{ipo.company_name}</strong>? This action will remove all linked records and cannot be undone.
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
        </AppLayout>
    );
}
