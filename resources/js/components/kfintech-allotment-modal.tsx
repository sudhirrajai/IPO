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
    TrendingUp,
    X,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
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
    name_from_pan?: string | null;
    dp_clid?: string | null;
    pan_masked?: string | null;
    pan_full?: string | null;
    kfin_ipo_name?: string | null;
    checked_at?: string | null;
}

export type AllotmentProviderTab = 'kfintech' | 'nse' | 'bse' | 'registrars';

interface MultiSourceAllotmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: AllotmentResultData | null;
    companyName?: string;
    symbol?: string;
    batchNumber?: string;
    applicationNumber?: string;
    panNumber?: string;
    applicantName?: string;
    currentStatus?: string;
    onRecheck?: () => void;
    onMarkStatus?: (status: 'allotted' | 'not_allotted') => void;
}

export default function KfintechAllotmentModal({
    isOpen,
    onClose,
    isLoading,
    result,
    companyName,
    symbol,
    batchNumber,
    applicationNumber,
    panNumber,
    applicantName,
    currentStatus,
    onRecheck,
    onMarkStatus,
}: MultiSourceAllotmentModalProps) {
    const [activeTab, setActiveTab] = useState<AllotmentProviderTab>('kfintech');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const isAllotted = Boolean(result?.allotted);
    const isFound = Boolean(result?.found);

    const effectivePan =
        panNumber ||
        result?.pan_full ||
        result?.pan_masked ||
        '';

    const effectiveAppNo =
        applicationNumber ||
        result?.application_number ||
        batchNumber ||
        '';

    const effectiveSymbol = (symbol || '').toUpperCase().trim();

    const handleCopy = (text: string, fieldName: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(fieldName);
            setTimeout(() => setCopiedField(null), 2000);
        });
    };

    const nseVerificationUrl = 'https://www.nseindia.com/invest/check-trades-bids-verify-ipo-bids';
    const bseVerificationUrl = 'https://www.bseindia.com/investors/appli_check';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden sm:rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-2xl">
                {/* Header branding strip */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center font-bold text-base text-amber-300 border border-white/20 shadow-inner">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300 block">
                                    IPO Allotment & Bid Verification Center
                                </span>
                                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
                                    {companyName || 'IPO Allotment Status'}
                                    {effectiveSymbol && (
                                        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-white/10 text-amber-200 border border-white/10">
                                            {effectiveSymbol}
                                        </span>
                                    )}
                                </h2>
                            </div>
                        </div>

                        {currentStatus && (
                            <Badge
                                variant="outline"
                                className="border-white/20 text-white/90 text-[10px] uppercase tracking-wider capitalize hidden sm:inline-flex"
                            >
                                Status: {currentStatus.replace('_', ' ')}
                            </Badge>
                        )}
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto scrollbar-none">
                        <button
                            type="button"
                            onClick={() => setActiveTab('kfintech')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'kfintech'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <span className="h-2 w-2 rounded-full bg-blue-300" />
                            KFintech API
                            {result?.found && (
                                <span className="text-[10px] bg-emerald-500/80 text-white px-1.5 py-0.2 rounded-full">
                                    Active
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('nse')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'nse'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <span className="h-2 w-2 rounded-full bg-amber-300" />
                            NSE India (Exchange)
                            <span className="text-[9px] bg-amber-400/20 text-amber-200 border border-amber-400/30 px-1 rounded">
                                All Registrars
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('bse')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'bse'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <span className="h-2 w-2 rounded-full bg-indigo-300" />
                            BSE India (Exchange)
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('registrars')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                activeTab === 'registrars'
                                    ? 'bg-neutral-700 text-white shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Building2 className="h-3 w-3" />
                            Other Registrars
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* TAB 1: KFINTECH */}
                    {activeTab === 'kfintech' && (
                        <div>
                            {isLoading ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                        Connecting to KFintech Allotment Gateway...
                                    </p>
                                    <p className="text-xs text-neutral-500 max-w-sm">
                                        Querying PAN against KFintech registry and extracting verified allotment details.
                                    </p>
                                </div>
                            ) : !result ? (
                                <div className="py-8 text-center text-sm text-neutral-500">
                                    No allotment query performed yet.
                                </div>
                            ) : !result.success || !isFound ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                                        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                                {!result.success
                                                    ? 'Not Available on KFintech Registry'
                                                    : 'Record Not Finalized Yet on KFintech'}
                                            </h4>
                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                                {result.message ||
                                                    'No allotment record found for this PAN in KFintech.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Smart Exchange Fallback Recommendation */}
                                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 p-4 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                                        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs uppercase tracking-wider">
                                            <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                            Why check on Stock Exchanges?
                                        </div>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                            Many IPOs use <strong>Link Intime</strong>, <strong>Bigshare</strong>, or <strong>Skyline</strong> instead of KFintech. Both <strong>NSE India</strong> and <strong>BSE India</strong> receive official allotment basis from <em>all registrars</em> across all IPOs placed on their exchanges.
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => setActiveTab('nse')}
                                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                                            >
                                                Verify on NSE (Symbol: {effectiveSymbol || 'Select'})
                                                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setActiveTab('bse')}
                                                className="text-xs h-8"
                                            >
                                                Verify on BSE
                                                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* KFintech Success Result Card */
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                                        <div>
                                            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50 uppercase tracking-tight">
                                                {result.kfin_ipo_name || companyName || 'IPO ALLOTMENT'}
                                            </h3>
                                            {batchNumber && (
                                                <span className="text-xs font-mono text-neutral-400">
                                                    Batch: {batchNumber}
                                                </span>
                                            )}
                                        </div>

                                        <Badge
                                            className={`px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${
                                                isAllotted
                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-600 border-none'
                                                    : 'bg-red-600 text-white hover:bg-red-600 border-none'
                                            }`}
                                        >
                                            {isAllotted ? 'Allotted' : 'Not Allotted'}
                                        </Badge>
                                    </div>

                                    {/* 2-Column Info Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 p-4 border border-neutral-200 dark:border-neutral-800">
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-[11px] uppercase tracking-wider text-neutral-400 block font-medium">
                                                    Application Number:
                                                </span>
                                                <span className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                                                    {result.application_number || '—'}
                                                </span>
                                            </div>

                                            <div>
                                                <span className="text-[11px] uppercase tracking-wider text-neutral-400 block font-medium">
                                                    DP ID Client ID:
                                                </span>
                                                <span className="text-sm font-semibold font-mono text-neutral-800 dark:text-neutral-200">
                                                    {result.dp_clid || '—'}
                                                </span>
                                            </div>

                                            <div>
                                                <span className="text-[11px] uppercase tracking-wider text-neutral-400 block font-medium">
                                                    Applied:
                                                </span>
                                                <span className="text-base font-extrabold text-neutral-900 dark:text-neutral-100">
                                                    {result.app_shares ?? '—'} Shares
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-[11px] uppercase tracking-wider text-neutral-400 block font-medium">
                                                    Name:
                                                </span>
                                                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                                                    {result.name_from_pan || '—'}
                                                </span>
                                            </div>

                                            <div>
                                                <span className="text-[11px] uppercase tracking-wider text-neutral-400 block font-medium">
                                                    PAN:
                                                </span>
                                                <span className="text-sm font-semibold font-mono text-neutral-800 dark:text-neutral-200">
                                                    {result.pan_full || result.pan_masked || '—'}
                                                </span>
                                            </div>

                                            <div>
                                                <span className="text-[11px] uppercase tracking-wider text-neutral-400 block font-medium">
                                                    Allotted:
                                                </span>
                                                <span
                                                    className={`text-base font-extrabold ${
                                                        isAllotted
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-neutral-900 dark:text-neutral-100'
                                                    }`}
                                                >
                                                    {result.all_shares ?? 0} Shares
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary notice */}
                                    <div className="text-xs text-neutral-500 flex items-center justify-between pt-1">
                                        <span>
                                            {isAllotted
                                                ? '🎉 Congratulations! Shares have been allotted to your account.'
                                                : 'No shares were allotted. UPI mandate will be unblocked by your bank.'}
                                        </span>
                                        {result.checked_at && (
                                            <span className="text-[10px] text-neutral-400">
                                                Checked:{' '}
                                                {new Date(result.checked_at).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: NSE INDIA */}
                    {activeTab === 'nse' && (
                        <div className="space-y-5">
                            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                                        National Stock Exchange of India
                                    </span>
                                    <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                                        Verify Trades & IPO Bids / Allotment
                                    </h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Exchange will also provide Allotment information as provided by the registrar to the issue.
                                    </p>
                                </div>
                                <a
                                    href={nseVerificationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 text-xs text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1 hover:underline"
                                >
                                    Open Portal <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>

                            {/* Quick Copy Inputs Card */}
                            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/60 p-4 border border-neutral-200 dark:border-neutral-800 space-y-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                                    Copy Pre-filled Query Parameters
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Symbol */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                            <span className="text-[10px] text-neutral-400 block font-medium">
                                                1. Select Symbol:
                                            </span>
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
                                            className="h-7 w-7 p-0 shrink-0"
                                            title="Copy Symbol"
                                        >
                                            {copiedField === 'symbol' ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* PAN */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                            <span className="text-[10px] text-neutral-400 block font-medium">
                                                2. Paste PAN No:
                                            </span>
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
                                            className="h-7 w-7 p-0 shrink-0"
                                            title="Copy PAN"
                                        >
                                            {copiedField === 'pan' ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* Application No */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                            <span className="text-[10px] text-neutral-400 block font-medium">
                                                OR App No:
                                            </span>
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
                                            className="h-7 w-7 p-0 shrink-0"
                                            title="Copy Application Number"
                                        >
                                            {copiedField === 'appno' ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Easy Steps Walkthrough */}
                            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-2">
                                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <HelpCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    How to check on NSE India in 30 seconds
                                </h4>
                                <ol className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1.5 list-decimal pl-4">
                                    <li>
                                        Click the <strong>Open NSE Portal</strong> button below.
                                    </li>
                                    <li>
                                        Keep <strong>Equity & SME IPO bid details</strong> selected.
                                    </li>
                                    <li>
                                        Select Symbol <strong>{effectiveSymbol || 'your IPO symbol'}</strong> from the dropdown.
                                    </li>
                                    <li>
                                        Paste your PAN No <strong>{effectivePan || ''}</strong> and click <strong>Submit</strong>.
                                    </li>
                                    <li>
                                        Check the <strong>Allotment Details</strong> table at the bottom of the results: Quantity shows allotted shares.
                                    </li>
                                </ol>
                            </div>

                            {/* Launch CTA */}
                            <div className="pt-1">
                                <a
                                    href={nseVerificationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-3 px-4 text-xs shadow-md transition-all"
                                >
                                    Open NSE Verification Portal (nseindia.com)
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: BSE INDIA */}
                    {activeTab === 'bse' && (
                        <div className="space-y-5">
                            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                                        Bombay Stock Exchange (BSE)
                                    </span>
                                    <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                                        Status of Issue Application & Allotment
                                    </h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Check real-time application and allotment status for all BSE-listed issues.
                                    </p>
                                </div>
                                <a
                                    href={bseVerificationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 text-xs text-indigo-600 dark:text-indigo-400 font-semibold inline-flex items-center gap-1 hover:underline"
                                >
                                    Open Portal <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>

                            {/* Quick Copy Inputs Card */}
                            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/60 p-4 border border-neutral-200 dark:border-neutral-800 space-y-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                                    Copy Query Parameters
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Issue Name */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                            <span className="text-[10px] text-neutral-400 block font-medium">
                                                1. Issue Name:
                                            </span>
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
                                            className="h-7 w-7 p-0 shrink-0"
                                            title="Copy Issue Name"
                                        >
                                            {copiedField === 'company' ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* PAN */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                            <span className="text-[10px] text-neutral-400 block font-medium">
                                                2. Paste PAN No:
                                            </span>
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
                                            className="h-7 w-7 p-0 shrink-0"
                                            title="Copy PAN"
                                        >
                                            {copiedField === 'pan' ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* Application No */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                            <span className="text-[10px] text-neutral-400 block font-medium">
                                                OR App No:
                                            </span>
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
                                            className="h-7 w-7 p-0 shrink-0"
                                            title="Copy Application Number"
                                        >
                                            {copiedField === 'appno' ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Easy Steps Walkthrough */}
                            <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-4 space-y-2">
                                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <HelpCircle className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                    How to check on BSE India
                                </h4>
                                <ol className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1.5 list-decimal pl-4">
                                    <li>Click <strong>Open BSE Portal</strong> below.</li>
                                    <li>Select Issue Type: <strong>Equity</strong>.</li>
                                    <li>Select <strong>{companyName || 'Issue Name'}</strong> from the dropdown.</li>
                                    <li>Paste PAN No <strong>{effectivePan || ''}</strong>.</li>
                                    <li>Type the simple 6-character captcha displayed and click <strong>Submit</strong>.</li>
                                </ol>
                            </div>

                            {/* Launch CTA */}
                            <div className="pt-1">
                                <a
                                    href={bseVerificationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3 px-4 text-xs shadow-md transition-all"
                                >
                                    Open BSE Application Check (bseindia.com)
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: OTHER REGISTRARS */}
                    {activeTab === 'registrars' && (
                        <div className="space-y-4">
                            <div className="border-b border-neutral-100 dark:border-neutral-800 pb-3">
                                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                                    Direct Registrar Allotment Portals
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    If the IPO is not managed by KFintech, check directly on the assigned registrar's official portal.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Link Intime */}
                                <a
                                    href="https://linkintime.co.in/initial_offer/public-issues.html"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 transition-all flex items-start justify-between group"
                                >
                                    <div>
                                        <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                            Link Intime India
                                            <ExternalLink className="h-3 w-3 text-neutral-400 group-hover:text-blue-600" />
                                        </div>
                                        <span className="text-[11px] text-neutral-500 block mt-1">
                                            Major Mainboard & SME Registrar
                                        </span>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px]">
                                        Popular
                                    </Badge>
                                </a>

                                {/* Bigshare Services */}
                                <a
                                    href="https://ipo.bigshareonline.com/ipo_status.html"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 transition-all flex items-start justify-between group"
                                >
                                    <div>
                                        <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                            Bigshare Services
                                            <ExternalLink className="h-3 w-3 text-neutral-400 group-hover:text-blue-600" />
                                        </div>
                                        <span className="text-[11px] text-neutral-500 block mt-1">
                                            Major SME & Mainboard Registrar
                                        </span>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px]">
                                        Popular
                                    </Badge>
                                </a>

                                {/* Skyline Financial */}
                                <a
                                    href="https://www.skylinerta.com/ipo.php"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 transition-all flex items-start justify-between group"
                                >
                                    <div>
                                        <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                            Skyline Financial
                                            <ExternalLink className="h-3 w-3 text-neutral-400 group-hover:text-blue-600" />
                                        </div>
                                        <span className="text-[11px] text-neutral-500 block mt-1">
                                            SME IPO Registry
                                        </span>
                                    </div>
                                </a>

                                {/* Purva Sharegistry */}
                                <a
                                    href="https://www.purvashare.com/queries/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/80 transition-all flex items-start justify-between group"
                                >
                                    <div>
                                        <div className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                                            Purva Sharegistry
                                            <ExternalLink className="h-3 w-3 text-neutral-400 group-hover:text-blue-600" />
                                        </div>
                                        <span className="text-[11px] text-neutral-500 block mt-1">
                                            SME IPO Registry
                                        </span>
                                    </div>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Quick 1-Click Status Update Bar (Available across all tabs!) */}
                    {onMarkStatus && (
                        <div className="rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-100 block">
                                    Verified your allotment on NSE, BSE, or Registrar?
                                </span>
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                                    Update this application's status in 1 click without leaving this dialog.
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => onMarkStatus('allotted')}
                                    className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Mark Allotted
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onMarkStatus('not_allotted')}
                                    className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/40"
                                >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Mark Not Allotted
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="bg-neutral-50 dark:bg-neutral-900 px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between sm:justify-between">
                    <div>
                        {activeTab === 'kfintech' && onRecheck && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isLoading}
                                onClick={onRecheck}
                                className="text-xs h-8"
                            >
                                <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                                Re-check KFintech
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
