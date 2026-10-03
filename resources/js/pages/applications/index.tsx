import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Ban,
    Check,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Eye,
    FileSpreadsheet,
    FileText,
    Filter,
    Landmark,
    Plus,
    Search,
    TrendingUp,
    X,
} from 'lucide-react';
import { useState } from 'react';
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
import type { ApplicationBatch, BreadcrumbItem, Ipo, User } from '@/types';

interface ApplicationsIndexProps {
    batches: {
        data: ApplicationBatch[];
        current_page: number;
        last_page: number;
        total: number;
    };
    ipos: Ipo[];
    users: User[];
    filters: {
        ipo_id?: string;
        user_id?: string;
        funding_source?: string;
        application_status?: string;
        settlement_status?: string;
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
    filters,
    isAdmin,
}: ApplicationsIndexProps) {
    const [selectedIpo, setSelectedIpo] = useState(filters.ipo_id || 'all');
    const [selectedUser, setSelectedUser] = useState(filters.user_id || 'all');
    const [selectedFunding, setSelectedFunding] = useState(filters.funding_source || 'all');
    const [selectedStatus, setSelectedStatus] = useState(filters.application_status || 'all');
    const [selectedSettlement, setSelectedSettlement] = useState(filters.settlement_status || 'all');

    // Cancel modal
    const [cancellingBatch, setCancellingBatch] = useState<ApplicationBatch | null>(null);
    const [cancelReason, setCancelReason] = useState('');

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

    const handleFilterChange = (key: string, value: string) => {
        const query: Record<string, string> = {
            ipo_id: selectedIpo,
            user_id: selectedUser,
            funding_source: selectedFunding,
            application_status: selectedStatus,
            settlement_status: selectedSettlement,
            [key]: value,
        };

        Object.keys(query).forEach((k) => {
            if (query[k] === 'all' || !query[k]) delete query[k];
        });

        router.get('/applications', query, { preserveState: true, replace: true });
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
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                            {isAdmin ? 'All Application Batches' : 'My Applications'}
                        </h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Historical records and rate snapshots for each application submission.
                        </p>
                    </div>

                    <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Link href="/ipos">
                            <Plus className="mr-2 h-4 w-4" />
                            Apply in Active IPO
                        </Link>
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <Select
                        value={selectedIpo}
                        onValueChange={(val) => {
                            setSelectedIpo(val);
                            handleFilterChange('ipo_id', val);
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
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
                            <SelectTrigger className="w-[160px]">
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
                        <SelectTrigger className="w-[150px]">
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
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="App Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All App Statuses</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="allotted">Allotted</SelectItem>
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
                        <SelectTrigger className="w-[160px]">
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
                                No applications match the selected criteria.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
                                        <tr>
                                            <th className="py-3 px-4">Applicant & ID</th>
                                            <th className="py-3 px-4">IPO</th>
                                            <th className="py-3 px-4">Bank</th>
                                            <th className="py-3 px-4">Amount</th>
                                            <th className="py-3 px-4">Profit Sharing</th>
                                            <th className="py-3 px-4">Payout</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                        {batches.data.map((batch) => {
                                            const isAllotted = batch.application_status === 'allotted';
                                            const isNotAllotted = batch.application_status === 'not_allotted';
                                            const isPending = !isAllotted && !isNotAllotted && batch.application_status !== 'cancelled';
                                            const appAmount = Number(batch.ipo_amount || batch.capital_amount || 0);

                                            return (
                                                <tr key={batch.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                                                    <td className="py-3 px-4">
                                                        <span className="font-semibold block text-neutral-900 dark:text-neutral-100">
                                                            {batch.applicant_name || batch.user?.name || 'Applicant'}
                                                        </span>
                                                        <span className="font-mono text-xs text-neutral-400">
                                                            {batch.batch_number}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 font-medium">
                                                        <Link href={`/ipos/${batch.ipo_id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                                                            {batch.ipo?.company_name}
                                                        </Link>
                                                        <span className="text-[11px] text-neutral-400 block">
                                                            {batch.application_count} lot(s)
                                                        </span>
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
                                                            {batch.funding_source === 'my_money' ? 'My Capital' : 'User Capital'}
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
                                                    <td className="py-3 px-4 font-semibold text-emerald-600">
                                                        {formatInr(isAllotted ? (batch.settled_user_payout ?? batch.expected_user_payout) : isNotAllotted ? 0 : batch.expected_user_payout)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] uppercase font-semibold ${
                                                                isAllotted
                                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                    : isNotAllotted
                                                                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                                    : 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                            }`}
                                                        >
                                                            {isAllotted ? 'Allotted' : isNotAllotted ? 'Not Allotted' : batch.application_status.replace('_', ' ')}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isPending && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleStatusChange(batch.id, 'allotted')}
                                                                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                                                        title="Mark Allotted"
                                                                    >
                                                                        <Check className="h-3 w-3 mr-1" /> Allotted
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleStatusChange(batch.id, 'not_allotted')}
                                                                        className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                        title="Mark Not Allotted"
                                                                    >
                                                                        <X className="h-3 w-3 mr-1" /> Not Allotted
                                                                    </Button>
                                                                </>
                                                            )}

                                                            {isAllotted && (
                                                                <span className="text-xs text-emerald-600 font-medium inline-flex items-center">
                                                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Settled
                                                                </span>
                                                            )}

                                                            {isNotAllotted && (
                                                                <span className="text-xs text-neutral-500 font-medium">
                                                                    Refunded
                                                                </span>
                                                            )}

                                                            {batch.application_status !== 'cancelled' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-neutral-400 hover:text-red-600 h-7 text-xs ml-1"
                                                                    onClick={() => setCancellingBatch(batch)}
                                                                    title="Cancel Application"
                                                                >
                                                                    <Ban className="h-3.5 w-3.5" />
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
