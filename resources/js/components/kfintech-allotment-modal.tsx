import { CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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

interface KfintechAllotmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: AllotmentResultData | null;
    companyName?: string;
    batchNumber?: string;
    onRecheck?: () => void;
}

export default function KfintechAllotmentModal({
    isOpen,
    onClose,
    isLoading,
    result,
    companyName,
    batchNumber,
    onRecheck,
}: KfintechAllotmentModalProps) {
    const isAllotted = Boolean(result?.allotted);
    const isFound = Boolean(result?.found);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-2xl border-neutral-200 dark:border-neutral-800 shadow-2xl">
                {/* Header branding strip matching KFintech portal */}
                <div className="bg-gradient-to-r from-sky-700 via-blue-700 to-sky-900 px-6 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm tracking-wider text-sky-200 border border-white/20">
                            KF
                        </div>
                        <div>
                            <span className="text-[11px] font-semibold uppercase tracking-widest text-sky-200 block">
                                Registrar Allotment Status
                            </span>
                            <span className="text-sm font-bold tracking-tight text-white">
                                KFintech Registry Live Check
                            </span>
                        </div>
                    </div>
                    <a
                        href="https://ipostatus.kfintech.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-200 hover:text-white inline-flex items-center gap-1 hover:underline"
                    >
                        ipostatus.kfintech.com <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                <div className="p-6 space-y-5">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                Connecting to KFintech Allotment Gateway...
                            </p>
                            <p className="text-xs text-neutral-500 max-w-sm">
                                Querying PAN against KFintech registry and extracting verified allotment details and investor name.
                            </p>
                        </div>
                    ) : !result ? (
                        <div className="py-8 text-center text-sm text-neutral-500">
                            No allotment query performed yet.
                        </div>
                    ) : !result.success ? (
                        <div className="py-6 space-y-3">
                            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-800 flex items-start gap-3">
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">
                                        Could not retrieve allotment
                                    </h4>
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                        {result.message || 'Unable to fetch allotment records from KFintech.'}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500 text-center">
                                If the issue is newly closed or registered with Link Intime or Bigshare instead, verify the registrar on the IPO details page.
                            </p>
                        </div>
                    ) : !isFound ? (
                        <div className="py-6 space-y-3">
                            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                        Allotment Not Finalized or Record Not Found
                                    </h4>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                        {result.message || 'No allotment record found for this PAN in KFintech registry yet.'}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500 text-center">
                                Registrars typically finalize and release allotment basis by late evening on the scheduled allotment date.
                            </p>
                        </div>
                    ) : (
                        /* Result card matching KFintech screenshot styling */
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

                            {/* 2-Column Info Grid matching user screenshot */}
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
                                        ? '🎉 Congratulations! Shares have been credited to your demat account.'
                                        : 'No shares were allotted. UPI mandate will be automatically unblocked by your bank.'}
                                </span>
                                {result.checked_at && (
                                    <span className="text-[10px] text-neutral-400">
                                        Checked: {new Date(result.checked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="bg-neutral-50 dark:bg-neutral-900 px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between sm:justify-between">
                    <div>
                        {onRecheck && (
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
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4"
                    >
                        Back
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
