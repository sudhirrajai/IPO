import {
    ArrowUpRight,
    Building2,
    Check,
    CheckCircle2,
    Copy,
    ExternalLink,
    HelpCircle,
    Info,
    Loader2,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    X,
    XCircle,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
} from '@/components/ui/dialog';

export interface AllotmentResultData {
    success: boolean;
    found?: boolean;
    status?: string;
    message?: string;
    allotted?: boolean;
    all_shares?: number;
    app_shares?: number;
    application_number?: string | null;
    order_number?: string | null;
    upi_amount?: string | null;
    upi_status?: string | null;
    allotment_price?: string | null;
    name_from_pan?: string | null;
    dp_clid?: string | null;
    pan_masked?: string | null;
    pan_full?: string | null;
    pan?: string | null;
    symbol?: string | null;
    provider?: 'nse' | 'bse' | 'kfintech' | 'auto' | string;
    kfin_ipo_name?: string | null;
    checked_at?: string | null;
    queued?: boolean;
}

export type AllotmentProviderTab = 'smart' | 'nse' | 'bse' | 'kfintech' | 'registrars';

interface MultiSourceAllotmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: AllotmentResultData | null;
    batchId?: number;
    companyName?: string;
    symbol?: string;
    batchNumber?: string;
    applicationNumber?: string;
    panNumber?: string;
    applicantName?: string;
    currentStatus?: string;
    onRecheck?: (provider?: 'auto' | 'nse' | 'bse' | 'kfintech') => void;
    onMarkStatus?: (status: 'allotted' | 'not_allotted') => void;
    onStatusUpdate?: (statusData: any) => void;
}

export default function KfintechAllotmentModal({
    isOpen,
    onClose,
    isLoading,
    result,
    batchId,
    companyName,
    symbol,
    batchNumber,
    applicationNumber,
    panNumber,
    applicantName,
    currentStatus,
    onRecheck,
    onMarkStatus,
    onStatusUpdate,
}: MultiSourceAllotmentModalProps) {
    const [activeTab, setActiveTab] = useState<AllotmentProviderTab>('smart');
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [liveResult, setLiveResult] = useState<AllotmentResultData | null>(result);
    const [isCheckingBackground, setIsCheckingBackground] = useState<boolean>(false);

    // Keep liveResult synchronized with prop changes
    useEffect(() => {
        setLiveResult(result);
        if (result?.status === 'checking' || result?.queued) {
            setIsCheckingBackground(true);
        } else if (result && result.status !== 'checking') {
            setIsCheckingBackground(false);
        }
    }, [result]);

    // Live background polling when an allotment check is queued or running
    useEffect(() => {
        if (!isOpen || !batchId || !isCheckingBackground) {
            return;
        }

        let isMounted = true;
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/applications/${batchId}/allotment-status`, {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!response.ok) return;

                const data = await response.json();
                if (!isMounted || !data.success) return;

                if (!data.is_checking) {
                    setIsCheckingBackground(false);
                    clearInterval(pollInterval);

                    const details = data.allotment_details || {};
                    const hasAllotmentInfo = details.allotted !== undefined || details.allotted_shares !== undefined || Boolean(data.allotment_checked_at);
                    
                    const updatedResult: AllotmentResultData = {
                        success: true,
                        found: hasAllotmentInfo,
                        status: data.application_status,
                        allotted: Boolean(details.allotted || data.application_status === 'allotted'),
                        all_shares: details.allotted_shares ?? (details.all_shares ?? 0),
                        app_shares: details.applied_shares ?? (details.app_shares ?? 0),
                        application_number: details.application_number || applicationNumber,
                        order_number: details.order_number,
                        upi_amount: details.upi_amount,
                        upi_status: details.upi_status,
                        allotment_price: details.allotment_price,
                        provider: details.source || 'auto',
                        name_from_pan: details.name_from_pan,
                        dp_clid: details.dp_clid,
                        pan_masked: details.pan_masked,
                        pan_full: panNumber || undefined,
                        checked_at: details.checked_at || data.allotment_checked_at,
                        message: hasAllotmentInfo ? undefined : 'Verification completed. No allotment record found on exchange / registry.',
                    };

                    setLiveResult(updatedResult);
                    onStatusUpdate?.(data);
                }
            } catch (err) {
                console.error('Failed to poll allotment status', err);
            }
        }, 2500);

        return () => {
            isMounted = false;
            clearInterval(pollInterval);
        };
    }, [isOpen, batchId, isCheckingBackground, applicationNumber, panNumber, onStatusUpdate]);

    const activeResult = liveResult ?? result;
    const isAllotted = Boolean(activeResult?.allotted);
    const isFound = Boolean(activeResult?.found);

    const effectivePan =
        panNumber ||
        activeResult?.pan_full ||
        activeResult?.pan ||
        activeResult?.pan_masked ||
        '';

    const effectiveAppNo =
        applicationNumber ||
        activeResult?.application_number ||
        batchNumber ||
        '';

    const effectiveSymbol = (symbol || activeResult?.symbol || '').toUpperCase().trim();

    const handleCopy = (text: string, fieldName: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(fieldName);
            setTimeout(() => setCopiedField(null), 2000);
        });
    };

    const nseVerificationUrl = 'https://www.nseindia.com/invest/check-trades-bids-verify-ipo-bids';
    const bseVerificationUrl = 'https://www.bseindia.com/investors/appli_check';

    const providerLabel = (p?: string) => {
        switch (p?.toLowerCase()) {
            case 'nse':
                return 'NSE India (Exchange)';
            case 'bse':
                return 'BSE India (Exchange)';
            case 'kfintech':
                return 'KFintech Registry';
            default:
                return 'Exchange / Registrar';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl w-[94vw] sm:w-full max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-2xl">
                {/* Header branding strip */}
                <div className="shrink-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 sm:px-6 pt-4 pb-3 text-white border-b border-white/10">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center font-bold text-amber-300 border border-white/20 shadow-inner shrink-0">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300 block truncate">
                                    Allotment & Bid Verification Center
                                </span>
                                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                                    <span className="truncate">{companyName || 'IPO Allotment'}</span>
                                    {effectiveSymbol && (
                                        <span className="text-[11px] font-mono font-medium px-1.5 py-0.2 rounded bg-white/10 text-amber-200 border border-white/15 shrink-0">
                                            {effectiveSymbol}
                                        </span>
                                    )}
                                </h2>
                            </div>
                        </div>

                        {currentStatus && (
                            <Badge
                                variant="outline"
                                className="border-white/20 text-white/90 text-[10px] uppercase tracking-wider capitalize shrink-0 hidden sm:inline-flex"
                            >
                                {currentStatus.replace('_', ' ')}
                            </Badge>
                        )}
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto scrollbar-none text-xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab('smart')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg font-semibold transition-all whitespace-nowrap text-xs ${
                                activeTab === 'smart'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Sparkles className="h-3 w-3 text-amber-300" />
                            Auto-Check
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('nse')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg font-semibold transition-all whitespace-nowrap text-xs ${
                                activeTab === 'nse'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            NSE India
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('bse')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg font-semibold transition-all whitespace-nowrap text-xs ${
                                activeTab === 'bse'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
                            BSE India
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('kfintech')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg font-semibold transition-all whitespace-nowrap text-xs ${
                                activeTab === 'kfintech'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                            KFintech
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('registrars')}
                            className={`flex items-center gap-1 px-2.5 py-1.2 rounded-lg font-semibold transition-all whitespace-nowrap text-xs ${
                                activeTab === 'registrars'
                                    ? 'bg-neutral-700 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Building2 className="h-3 w-3" />
                            Other Registrars
                        </button>
                    </div>
                </div>

                {/* Body Content (Flex Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* LOADING STATE */}
                    {isLoading ? (
                        <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
                            <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
                            <div>
                                <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                                    {activeTab === 'nse'
                                        ? 'Scraping Live Verification from NSE India...'
                                        : activeTab === 'bse'
                                        ? 'Querying BSE India Live Allotment API...'
                                        : activeTab === 'kfintech'
                                        ? 'Connecting to KFintech Allotment Gateway...'
                                        : 'Querying Stock Exchanges & Registrars...'}
                                </p>
                                <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                                    {activeTab === 'nse'
                                        ? 'Running headless browser to pass captcha and extract bid/allotment records (~8-12s).'
                                        : 'Querying PAN and matching issue records directly.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* BACKGROUND CHECK IN PROGRESS BANNER */}
                            {(isCheckingBackground || activeResult?.status === 'checking' || activeResult?.queued) && (
                                <div className="rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-amber-500/10 border border-blue-500/30 p-4 space-y-3 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-amber-950/30">
                                    <div className="flex items-start gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                                                    <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                                                    Checking Allotment in Background
                                                </h4>
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                                </span>
                                            </div>
                                            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                                                Server queue workers are processing across BSE India, NSE India, and Registrars.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-white/80 dark:bg-black/40 p-2.5 text-[11px] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                                        <span className="truncate">
                                            ⚡ You can <strong>close this modal anytime</strong>. Processing continues in the background and status updates automatically.
                                        </span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={onClose}
                                            className="h-6 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                                        >
                                            Dismiss Modal
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* VERIFIED RESULT CARD (Displayed whenever result exists, was found, and not currently checking) */}
                            {activeResult?.success && isFound && !isCheckingBackground && activeResult.status !== 'checking' && (
                                <div className="space-y-3">
                                    {/* Allotment Status Banner */}
                                    <div
                                        className={`rounded-xl p-4 border flex items-center justify-between gap-3 ${
                                            isAllotted
                                                ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/15 to-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
                                                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                    isAllotted
                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                        : 'bg-rose-600 text-white shadow-sm'
                                                }`}
                                            >
                                                {isAllotted ? (
                                                    <CheckCircle2 className="h-6 w-6" />
                                                ) : (
                                                    <XCircle className="h-6 w-6" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider">
                                                        {isAllotted ? 'Allotment Confirmed' : 'Application Verified'}
                                                    </span>
                                                    <Badge
                                                        className={`text-[10px] uppercase font-bold px-2 py-0.2 border-none ${
                                                            isAllotted
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-rose-600 text-white'
                                                        }`}
                                                    >
                                                        {isAllotted ? 'Allotted' : 'Not Allotted'}
                                                    </Badge>
                                                </div>
                                                <p className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                                                    {isAllotted
                                                        ? `${activeResult.all_shares ?? 0} Shares Allotted!`
                                                        : '0 Shares Allotted'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                {providerLabel(activeResult.provider)}
                                            </Badge>
                                            {activeResult.allotment_price && (
                                                <span className="text-xs text-neutral-500 block mt-1">
                                                    Price: ₹{activeResult.allotment_price}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2-Column Metrics Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 p-3.5 border border-neutral-200 dark:border-neutral-800 text-xs">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                                                Applied Shares
                                            </span>
                                            <span className="font-bold text-neutral-900 dark:text-neutral-100">
                                                {activeResult.app_shares ?? '—'} Shares
                                            </span>
                                        </div>

                                        <div className="space-y-0.5">
                                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                                                Allotted Shares
                                            </span>
                                            <span
                                                className={`font-black ${
                                                    isAllotted
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-neutral-800 dark:text-neutral-200'
                                                }`}
                                            >
                                                {activeResult.all_shares ?? 0} Shares
                                            </span>
                                        </div>

                                        <div className="space-y-0.5">
                                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                                                Application No
                                            </span>
                                            <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 truncate block">
                                                {activeResult.application_number || '—'}
                                            </span>
                                        </div>

                                        {activeResult.order_number && (
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                                                    Exchange Order #
                                                </span>
                                                <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 truncate block">
                                                    {activeResult.order_number}
                                                </span>
                                            </div>
                                        )}

                                        {activeResult.upi_amount && (
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                                                    Blocked Amount
                                                </span>
                                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                                    ₹{Number(activeResult.upi_amount).toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        )}

                                        <div className="space-y-0.5">
                                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                                                PAN Number
                                            </span>
                                            <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                                                {effectivePan || '—'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                            <Check className="h-3 w-3" /> Saved & synced to application database
                                        </span>
                                        {activeResult.checked_at && (
                                            <span className="text-[10px] text-neutral-400">
                                                {new Date(activeResult.checked_at).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* NOT FOUND NOTIFICATION */}
                            {activeResult && !isCheckingBackground && activeResult.status !== 'checking' && (!activeResult.success || !isFound) && (
                                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3.5 border border-amber-200 dark:border-amber-800/70 flex items-start gap-2.5">
                                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <h4 className="font-semibold text-amber-900 dark:text-amber-200">
                                            No Allotment Record Found
                                        </h4>
                                        <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                                            {activeResult.message ||
                                                'The selected source has not finalized or published allotment for this application yet.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TAB 1: SMART AUTO-CHECK */}
                            {activeTab === 'smart' && (
                                <div className="space-y-3">
                                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 p-4 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
                                        <div>
                                            <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                                                <Zap className="h-4 w-4 text-amber-500" />
                                                Automated Multi-Source Allotment Verification
                                            </div>
                                            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                                                Automatically scans <strong>BSE India Live API</strong>, <strong>NSE India Headless Scraper</strong>, and <strong>KFintech Registry</strong> to find and verify this application.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <Button
                                                type="button"
                                                onClick={() => onRecheck?.('auto')}
                                                disabled={isLoading}
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 shadow-sm"
                                            >
                                                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                                                Auto-Check Everywhere
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setActiveTab('nse');
                                                    onRecheck?.('nse');
                                                }}
                                                disabled={isLoading}
                                                className="text-xs h-9"
                                            >
                                                <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
                                                Check NSE Only
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setActiveTab('bse');
                                                    onRecheck?.('bse');
                                                }}
                                                disabled={isLoading}
                                                className="text-xs h-9"
                                            >
                                                <span className="h-2 w-2 rounded-full bg-indigo-500 mr-1.5" />
                                                Check BSE Only
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: NSE INDIA (Automated Scraper + Manual Fallback) */}
                            {activeTab === 'nse' && (
                                <div className="space-y-3.5">
                                    {/* Action Banner */}
                                    <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 p-3.5 space-y-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                                                    National Stock Exchange (NSE India)
                                                </span>
                                                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                                    Automated Headless Scraper Available
                                                </h3>
                                                <p className="text-[11px] text-neutral-500 mt-0.5">
                                                    Our server runs a headless Chrome worker to bypass reCAPTCHA and fetch verified bid & allotment details directly from NSE.
                                                </p>
                                            </div>
                                            <a
                                                href={nseVerificationUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1 hover:underline shrink-0"
                                            >
                                                Open Site <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <Button
                                                type="button"
                                                onClick={() => onRecheck?.('nse')}
                                                disabled={isLoading}
                                                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 px-3 shadow-xs"
                                            >
                                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                                                Auto-Scrape NSE Now
                                            </Button>

                                            <a
                                                href={nseVerificationUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2 py-1"
                                            >
                                                Manual Check on Portal
                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                            </a>
                                        </div>
                                    </div>

                                    {/* Copy Parameters */}
                                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/60 p-3 border border-neutral-200 dark:border-neutral-800 space-y-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                                            Query Parameters (for manual check)
                                        </span>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                                <div className="truncate mr-1">
                                                    <span className="text-[9px] text-neutral-400 block font-medium">Symbol:</span>
                                                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 truncate block">
                                                        {effectiveSymbol || 'N/A'}
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={!effectiveSymbol}
                                                    onClick={() => handleCopy(effectiveSymbol, 'symbol')}
                                                    className="h-6 w-6 p-0 shrink-0"
                                                >
                                                    {copiedField === 'symbol' ? (
                                                        <Check className="h-3 w-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-neutral-500" />
                                                    )}
                                                </Button>
                                            </div>

                                            <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                                <div className="truncate mr-1">
                                                    <span className="text-[9px] text-neutral-400 block font-medium">PAN:</span>
                                                    <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 truncate block">
                                                        {effectivePan || 'N/A'}
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={!effectivePan}
                                                    onClick={() => handleCopy(effectivePan, 'pan')}
                                                    className="h-6 w-6 p-0 shrink-0"
                                                >
                                                    {copiedField === 'pan' ? (
                                                        <Check className="h-3 w-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-neutral-500" />
                                                    )}
                                                </Button>
                                            </div>

                                            <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                                <div className="truncate mr-1">
                                                    <span className="text-[9px] text-neutral-400 block font-medium">App No:</span>
                                                    <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 truncate block">
                                                        {effectiveAppNo || '—'}
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={!effectiveAppNo}
                                                    onClick={() => handleCopy(effectiveAppNo, 'appno')}
                                                    className="h-6 w-6 p-0 shrink-0"
                                                >
                                                    {copiedField === 'appno' ? (
                                                        <Check className="h-3 w-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-neutral-500" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: BSE INDIA (Live REST API) */}
                            {activeTab === 'bse' && (
                                <div className="space-y-3.5">
                                    <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/25 p-3.5 space-y-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
                                                    Bombay Stock Exchange (BSE India)
                                                </span>
                                                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                                    Instant Live REST API Integration
                                                </h3>
                                                <p className="text-[11px] text-neutral-500 mt-0.5">
                                                    Directly queries BSE's application status API in real time (&lt;1s response).
                                                </p>
                                            </div>
                                            <a
                                                href={bseVerificationUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold inline-flex items-center gap-1 hover:underline shrink-0"
                                            >
                                                Open Site <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <Button
                                                type="button"
                                                onClick={() => onRecheck?.('bse')}
                                                disabled={isLoading}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 px-3 shadow-xs"
                                            >
                                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                                                Auto-Check BSE Now
                                            </Button>

                                            <a
                                                href={bseVerificationUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2 py-1"
                                            >
                                                Manual Check on Portal
                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                            </a>
                                        </div>
                                    </div>

                                    {/* Copy Parameters */}
                                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/60 p-3 border border-neutral-200 dark:border-neutral-800 space-y-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                                            Query Parameters (for manual check)
                                        </span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                                <div className="truncate mr-1">
                                                    <span className="text-[9px] text-neutral-400 block font-medium">Issue Name:</span>
                                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                                                        {companyName || 'N/A'}
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={!companyName}
                                                    onClick={() => handleCopy(companyName || '', 'company')}
                                                    className="h-6 w-6 p-0 shrink-0"
                                                >
                                                    {copiedField === 'company' ? (
                                                        <Check className="h-3 w-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-neutral-500" />
                                                    )}
                                                </Button>
                                            </div>

                                            <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                                <div className="truncate mr-1">
                                                    <span className="text-[9px] text-neutral-400 block font-medium">PAN:</span>
                                                    <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 truncate block">
                                                        {effectivePan || 'N/A'}
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={!effectivePan}
                                                    onClick={() => handleCopy(effectivePan, 'pan')}
                                                    className="h-6 w-6 p-0 shrink-0"
                                                >
                                                    {copiedField === 'pan' ? (
                                                        <Check className="h-3 w-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-neutral-500" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: KFINTECH */}
                            {activeTab === 'kfintech' && (
                                <div className="space-y-3.5">
                                    <div className="rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/25 p-3.5 space-y-2.5">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                                                KFintech Technologies (Registrar)
                                            </span>
                                            <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                                Direct Registrar Database Check
                                            </h3>
                                            <p className="text-[11px] text-neutral-500 mt-0.5">
                                                Fetches DP ID, client ID, full allotment breakdown from KFintech.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <Button
                                                type="button"
                                                onClick={() => onRecheck?.('kfintech')}
                                                disabled={isLoading}
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-3 shadow-xs"
                                            >
                                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                                                Auto-Check KFintech
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: OTHER REGISTRARS */}
                            {activeTab === 'registrars' && (
                                <div className="space-y-3">
                                    <div className="border-b border-neutral-100 dark:border-neutral-800 pb-2">
                                        <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                            Official Registrar Allotment Portals
                                        </h3>
                                        <p className="text-[11px] text-neutral-500">
                                            If this IPO is managed by another registrar, check directly on their portal:
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <a
                                            href="https://linkintime.co.in/initial_offer/public-issues.html"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 hover:bg-neutral-100 transition-all flex items-center justify-between group"
                                        >
                                            <div>
                                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                                    Link Intime
                                                </span>
                                                <span className="text-[10px] text-neutral-500">Major Registrar</span>
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 text-neutral-400 group-hover:text-blue-600" />
                                        </a>

                                        <a
                                            href="https://ipo.bigshareonline.com/ipo_status.html"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 hover:bg-neutral-100 transition-all flex items-center justify-between group"
                                        >
                                            <div>
                                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                                    Bigshare Services
                                                </span>
                                                <span className="text-[10px] text-neutral-500">SME & Mainboard</span>
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 text-neutral-400 group-hover:text-blue-600" />
                                        </a>

                                        <a
                                            href="https://www.skylinerta.com/ipo.php"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 hover:bg-neutral-100 transition-all flex items-center justify-between group"
                                        >
                                            <div>
                                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                                    Skyline Financial
                                                </span>
                                                <span className="text-[10px] text-neutral-500">SME Registry</span>
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 text-neutral-400 group-hover:text-blue-600" />
                                        </a>

                                        <a
                                            href="https://www.purvashare.com/queries/"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 hover:bg-neutral-100 transition-all flex items-center justify-between group"
                                        >
                                            <div>
                                                <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                                                    Purva Sharegistry
                                                </span>
                                                <span className="text-[10px] text-neutral-500">SME Registry</span>
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 text-neutral-400 group-hover:text-blue-600" />
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* 1-Click Status Override Bar */}
                            {onMarkStatus && (
                                <div className="rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 p-2.5 flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                                        Manual override:
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => onMarkStatus('allotted')}
                                            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                        >
                                            <Check className="h-3 w-3 mr-1" />
                                            Mark Allotted
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onMarkStatus('not_allotted')}
                                            className="h-7 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/40"
                                        >
                                            <X className="h-3 w-3 mr-1" />
                                            Mark Not Allotted
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Fixed Footer */}
                <DialogFooter className="shrink-0 bg-neutral-50 dark:bg-neutral-900 px-4 sm:px-6 py-2.5 border-t border-neutral-200 dark:border-neutral-800 flex flex-row items-center justify-between gap-2">
                    <div>
                        {onRecheck && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isLoading}
                                onClick={() => onRecheck('auto')}
                                className="text-xs h-8"
                            >
                                <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                                Re-check All
                            </Button>
                        )}
                    </div>
                    <Button
                        type="button"
                        onClick={onClose}
                        className="bg-neutral-800 hover:bg-neutral-900 text-white text-xs h-8 px-4"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
