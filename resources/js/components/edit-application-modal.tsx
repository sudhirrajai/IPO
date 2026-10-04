import { router } from '@inertiajs/react';
import {
    AlertCircle,
    Building2,
    Calculator,
    Check,
    CreditCard,
    DollarSign,
    Edit3,
    Landmark,
    Percent,
    ShieldAlert,
    Smartphone,
    User,
    Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatInr } from '@/lib/utils';
import type { ApplicationBatch, BankAccount, Ipo, UserPan, UserUpi } from '@/types';

interface EditApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    batch: ApplicationBatch | null;
    userPans?: UserPan[];
    bankAccounts?: BankAccount[];
    userUpis?: UserUpi[];
    ipo: Ipo;
    isAdmin: boolean;
}

export default function EditApplicationModal({
    isOpen,
    onClose,
    batch,
    userPans = [],
    bankAccounts = [],
    userUpis = [],
    ipo,
    isAdmin,
}: EditApplicationModalProps) {
    if (!batch || !isAdmin) return null;

    const [applicantName, setApplicantName] = useState('');
    const [selectedPanId, setSelectedPanId] = useState('custom');
    const [panNumber, setPanNumber] = useState('');
    const [bankName, setBankName] = useState('');
    const [upiId, setUpiId] = useState('');
    const [upiApp, setUpiApp] = useState('Auto');
    const [profitSharingType, setProfitSharingType] = useState<'fix' | 'percentage' | 'rate_margin'>('fix');
    const [profitSharingValue, setProfitSharingValue] = useState('');
    const [overrideTraderRate, setOverrideTraderRate] = useState('');
    const [overridePublishedRate, setOverridePublishedRate] = useState('');
    const [fundingSource, setFundingSource] = useState<'my_money' | 'user_money'>('my_money');
    const [applicationCount, setApplicationCount] = useState(1);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!batch) return;

        setApplicantName(batch.applicant_name || '');
        const currentPan = batch.pan_number || batch.batch_pans?.[0]?.pan_number_snapshot || '';
        setPanNumber(currentPan);

        // Match with userPans
        const matched = userPans.find((p) => p.pan_number === currentPan);
        if (matched) {
            setSelectedPanId(String(matched.id));
        } else if (batch.batch_pans?.[0]?.user_pan_id) {
            setSelectedPanId(String(batch.batch_pans[0].user_pan_id));
        } else {
            setSelectedPanId('custom');
        }

        setBankName(batch.bank_name || '');
        setUpiId(batch.upi_id || '');
        setUpiApp(batch.upi_app || 'Auto');
        setProfitSharingType((batch.profit_sharing_type as 'fix' | 'percentage' | 'rate_margin') || 'fix');
        setProfitSharingValue(batch.profit_sharing_value ? String(batch.profit_sharing_value) : '');
        setOverrideTraderRate(batch.trader_rate_snapshot ? String(batch.trader_rate_snapshot) : '');
        setOverridePublishedRate(batch.published_rate_snapshot ? String(batch.published_rate_snapshot) : '');
        setFundingSource((batch.funding_source as 'my_money' | 'user_money') || 'my_money');
        setApplicationCount(batch.application_count || 1);
        setNotes(batch.notes || '');
        setErrorMessage('');
    }, [batch, userPans]);

    // When PAN selection changes
    const handlePanSelect = (val: string) => {
        setSelectedPanId(val);
        if (val === 'custom') {
            return;
        }
        const selected = userPans.find((p) => String(p.id) === val);
        if (selected) {
            setPanNumber(selected.pan_number);
            if (selected.account_holder_name) {
                setApplicantName(selected.account_holder_name);
            }
        }
    };

    // Live preview calculations
    const lotSize = Number(ipo.lot_size || 1);
    const issuePrice = Number(ipo.issue_price || ipo.price_band_max || 0);
    const capitalPerApp = lotSize * issuePrice;
    const totalCapital = capitalPerApp * applicationCount;
    const gmp = Number(batch.gmp_snapshot || ipo.gmp || 0);
    const expectedListingGain = lotSize * gmp * applicationCount;

    let previewUserPayout = 0;
    let previewGrossProfit = 0;
    let previewNetEarnings = 0;
    let previewMargin = 0;

    if (profitSharingType === 'fix') {
        const val = Number(profitSharingValue) || 0;
        previewUserPayout = val * applicationCount;
        previewGrossProfit = expectedListingGain > 0 ? expectedListingGain : previewUserPayout;
        previewNetEarnings = previewGrossProfit - previewUserPayout;
    } else if (profitSharingType === 'percentage') {
        const pct = Number(profitSharingValue) || 0;
        previewUserPayout = (pct / 100) * expectedListingGain;
        previewGrossProfit = expectedListingGain;
        previewNetEarnings = previewGrossProfit - previewUserPayout;
    } else {
        const trader = Number(overrideTraderRate) || 0;
        const pub = Number(overridePublishedRate) || 0;
        previewMargin = trader - pub;
        previewGrossProfit = trader * applicationCount;
        previewUserPayout = pub * applicationCount;
        previewNetEarnings = fundingSource === 'my_money'
            ? previewGrossProfit - previewUserPayout
            : previewMargin * applicationCount;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!batch) return;

        setIsSubmitting(true);
        setErrorMessage('');

        const payload: Record<string, any> = {
            applicant_name: applicantName,
            bank_name: bankName,
            upi_id: upiId,
            upi_app: upiApp,
            funding_source: fundingSource,
            application_count: applicationCount,
            profit_sharing_type: profitSharingType,
            notes: notes,
        };

        if (selectedPanId !== 'custom') {
            payload.pan_id = Number(selectedPanId);
        } else if (panNumber) {
            payload.pan_number = panNumber.toUpperCase().trim();
        }

        if (profitSharingType === 'rate_margin') {
            payload.override_trader_rate = Number(overrideTraderRate);
            payload.override_published_rate = Number(overridePublishedRate);
        } else {
            payload.profit_sharing_value = Number(profitSharingValue);
        }

        router.put(`/applications/${batch.id}`, payload, {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmitting(false);
                onClose();
            },
            onError: (err) => {
                setIsSubmitting(false);
                const firstErr = Object.values(err)[0];
                setErrorMessage(typeof firstErr === 'string' ? firstErr : 'Failed to update application.');
            },
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-2">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Edit3 className="h-5 w-5 text-emerald-600" />
                            Edit Application {batch.batch_number}
                        </DialogTitle>
                        <Badge variant="outline" className="font-mono text-xs uppercase">
                            Admin Only
                        </Badge>
                    </div>
                    <DialogDescription>
                        Update PAN card, applicant rates, profit sharing model, and banking details. Financials and settlements recalculate automatically.
                    </DialogDescription>
                </DialogHeader>

                {errorMessage && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* SECTION 1: PAN & APPLICANT */}
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/50 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                            PAN & Applicant Identification
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-medium">Select Saved PAN</Label>
                                <Select value={selectedPanId} onValueChange={handlePanSelect}>
                                    <SelectTrigger className="mt-1 h-9 text-xs">
                                        <SelectValue placeholder="Choose PAN Card" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="custom">+ Custom / Enter Directly</SelectItem>
                                        {userPans.map((p) => (
                                            <SelectItem key={p.id} value={String(p.id)}>
                                                {p.masked_pan} · {p.account_holder_name} ({p.broker_name || 'Generic'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-xs font-medium">PAN Number</Label>
                                <Input
                                    value={panNumber}
                                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                                    placeholder="e.g. ABCDE1234F"
                                    maxLength={10}
                                    className="mt-1 h-9 text-xs font-mono font-bold uppercase"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <Label className="text-xs font-medium">Applicant / Account Holder Name</Label>
                                <Input
                                    value={applicantName}
                                    onChange={(e) => setApplicantName(e.target.value)}
                                    placeholder="Name of primary demat holder"
                                    className="mt-1 h-9 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: RATES & PROFIT SHARING */}
                    <div className="p-4 rounded-xl border border-purple-200/80 bg-purple-50/30 dark:border-purple-900/40 dark:bg-purple-950/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-purple-600" />
                                Rates & Profit Sharing Model (Admin Override)
                            </h4>
                            <span className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">
                                GMP: ₹{gmp}
                            </span>
                        </div>

                        {/* Model Tabs */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setProfitSharingType('fix')}
                                className={`p-2.5 rounded-lg border text-left transition-all ${
                                    profitSharingType === 'fix'
                                        ? 'border-purple-600 bg-white dark:bg-neutral-800 shadow-xs'
                                        : 'border-neutral-200 bg-neutral-50/70 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
                                }`}
                            >
                                <span className="text-xs font-bold block text-neutral-900 dark:text-neutral-100">Fixed Profit</span>
                                <span className="text-[10px] text-neutral-500 block">Flat ₹ payout / lot</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setProfitSharingType('percentage')}
                                className={`p-2.5 rounded-lg border text-left transition-all ${
                                    profitSharingType === 'percentage'
                                        ? 'border-purple-600 bg-white dark:bg-neutral-800 shadow-xs'
                                        : 'border-neutral-200 bg-neutral-50/70 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
                                }`}
                            >
                                <span className="text-xs font-bold block text-neutral-900 dark:text-neutral-100">Percentage %</span>
                                <span className="text-[10px] text-neutral-500 block">% of listing gain</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setProfitSharingType('rate_margin')}
                                className={`p-2.5 rounded-lg border text-left transition-all ${
                                    profitSharingType === 'rate_margin'
                                        ? 'border-purple-600 bg-white dark:bg-neutral-800 shadow-xs'
                                        : 'border-neutral-200 bg-neutral-50/70 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
                                }`}
                            >
                                <span className="text-xs font-bold block text-neutral-900 dark:text-neutral-100">Rate Margin</span>
                                <span className="text-[10px] text-neutral-500 block">Trader vs User Rate</span>
                            </button>
                        </div>

                        {/* Model Inputs */}
                        {profitSharingType === 'fix' && (
                            <div>
                                <Label className="text-xs font-medium">Fixed Payout per Lot (₹)</Label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-2 text-xs font-semibold text-neutral-400">₹</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="10"
                                        placeholder="e.g. 1100"
                                        value={profitSharingValue}
                                        onChange={(e) => setProfitSharingValue(e.target.value)}
                                        className="h-9 pl-7 text-xs font-semibold"
                                    />
                                </div>
                                <span className="text-[10.5px] text-neutral-500 mt-1 block">
                                    User gets fixed payout of ₹{Number(profitSharingValue) || 0} upon successful allotment.
                                </span>
                            </div>
                        )}

                        {profitSharingType === 'percentage' && (
                            <div>
                                <Label className="text-xs font-medium">User Percentage of Listing Gain (%)</Label>
                                <div className="relative mt-1">
                                    <span className="absolute right-3 top-2 text-xs font-semibold text-neutral-400">%</span>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        placeholder="e.g. 70"
                                        value={profitSharingValue}
                                        onChange={(e) => setProfitSharingValue(e.target.value)}
                                        className="h-9 pr-7 text-xs font-semibold"
                                    />
                                </div>
                                <span className="text-[10.5px] text-neutral-500 mt-1 block">
                                    User gets {Number(profitSharingValue) || 0}% of the realized listing gains.
                                </span>
                            </div>
                        )}

                        {profitSharingType === 'rate_margin' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs font-medium">Trader Rate (₹)</Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-2 text-xs font-semibold text-neutral-400">₹</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="10"
                                            placeholder="e.g. 1300"
                                            value={overrideTraderRate}
                                            onChange={(e) => setOverrideTraderRate(e.target.value)}
                                            className="h-9 pl-7 text-xs font-semibold"
                                        />
                                    </div>
                                    <span className="text-[10px] text-neutral-400 mt-0.5 block">What trader pays you</span>
                                </div>

                                <div>
                                    <Label className="text-xs font-medium">Published / User Rate (₹)</Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-2 text-xs font-semibold text-neutral-400">₹</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="10"
                                            placeholder="e.g. 1100"
                                            value={overridePublishedRate}
                                            onChange={(e) => setOverridePublishedRate(e.target.value)}
                                            className="h-9 pl-7 text-xs font-semibold"
                                        />
                                    </div>
                                    <span className="text-[10px] text-neutral-400 mt-0.5 block">What user receives</span>
                                </div>

                                <div className="sm:col-span-2 p-2 rounded-md bg-purple-100/60 dark:bg-purple-900/30 text-xs flex items-center justify-between text-purple-900 dark:text-purple-200 font-semibold">
                                    <span>Calculated Admin Margin per Lot:</span>
                                    <span>{formatInr(previewMargin)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: BANK & LOT CONFIGURATION */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs font-medium">Lots / Applications</Label>
                            <Input
                                type="number"
                                min="1"
                                max="100"
                                value={applicationCount}
                                onChange={(e) => setApplicationCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="mt-1 h-9 text-xs font-semibold"
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-medium">Funding Source</Label>
                            <Select value={fundingSource} onValueChange={(val: 'my_money' | 'user_money') => setFundingSource(val)}>
                                <SelectTrigger className="mt-1 h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="my_money">Admin Capital (My Money)</SelectItem>
                                    <SelectItem value="user_money">Applicant Capital (User Money)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs font-medium">Bank Name</Label>
                            <Input
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                placeholder="e.g. HDFC Bank"
                                className="mt-1 h-9 text-xs"
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-medium">UPI ID</Label>
                            <Input
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                placeholder="e.g. username@okhdfcbank"
                                className="mt-1 h-9 text-xs font-mono"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <Label className="text-xs font-medium">Notes / Reference</Label>
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Optional internal notes"
                                className="mt-1 h-9 text-xs"
                            />
                        </div>
                    </div>

                    {/* LIVE CALCULATION PREVIEW */}
                    <div className="p-3.5 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-2xs space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
                            Recalculated Financials Preview
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/70">
                                <span className="text-[10px] text-neutral-400 block">Total Capital</span>
                                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                                    {formatInr(totalCapital)}
                                </span>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30">
                                <span className="text-[10px] text-emerald-600 block">Applicant Payout</span>
                                <span className="text-sm font-bold text-emerald-600">
                                    {formatInr(previewUserPayout)}
                                </span>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-50/70 dark:bg-purple-950/30">
                                <span className="text-[10px] text-purple-600 block">Admin Margin</span>
                                <span className="text-sm font-bold text-purple-600">
                                    {formatInr(previewNetEarnings)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving Changes...' : 'Save & Update Application'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
