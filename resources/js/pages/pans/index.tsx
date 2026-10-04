import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    CreditCard,
    Edit2,
    Eye,
    EyeOff,
    Filter,
    LayoutGrid,
    List,
    Plus,
    Search,
    ShieldAlert,
    ShieldCheck,
    Trash2,
} from 'lucide-react';

import { useState } from 'react';
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
import type { BreadcrumbItem, User, UserPan } from '@/types';

interface PansIndexProps {
    pans: {
        data: UserPan[];
        current_page: number;
        last_page: number;
        total: number;
    };
    users: User[];
    filters: {
        user_id?: string;
        search?: string;
    };
    isAdmin: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'PAN Registry',
        href: '/pans',
    },
];

export default function PansIndex({ pans, users, filters, isAdmin }: PansIndexProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;

    const [search, setSearch] = useState(filters.search || '');
    const [selectedUser, setSelectedUser] = useState(filters.user_id || 'all');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

    // Modals
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingPan, setEditingPan] = useState<UserPan | null>(null);
    const [deletingPan, setDeletingPan] = useState<UserPan | null>(null);


    // Revealed PAN numbers cache { panId: fullPanString }
    const [revealedPans, setRevealedPans] = useState<Record<number, string>>({});
    const [revealingId, setRevealingId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Add PAN form
    const [newPanUserId, setNewPanUserId] = useState(isAdmin ? (users[0]?.id ? String(users[0].id) : '') : String(auth.user.id));
    const [newPanNumber, setNewPanNumber] = useState('');
    const [newHolderName, setNewHolderName] = useState('');
    const [newBrokerName, setNewBrokerName] = useState('');
    const [newNotes, setNewNotes] = useState('');

    // Edit PAN form
    const [editUserId, setEditUserId] = useState('');
    const [editPanNumber, setEditPanNumber] = useState('');
    const [editHolderName, setEditHolderName] = useState('');
    const [editBrokerName, setEditBrokerName] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

    const handleFilterChange = (key: string, value: string) => {
        const query: Record<string, string> = {
            search,
            user_id: selectedUser,
            [key]: value,
        };

        if (query.user_id === 'all' || !query.user_id) delete query.user_id;
        if (!query.search) delete query.search;

        router.get('/pans', query, { preserveState: true, replace: true });
    };

    const handleReveal = async (pan: UserPan) => {
        if (revealedPans[pan.id]) {
            const copy = { ...revealedPans };
            delete copy[pan.id];
            setRevealedPans(copy);
            return;
        }

        setRevealingId(pan.id);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch(`/pans/${pan.id}/reveal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });

            if (res.ok) {
                const data = await res.json();
                setRevealedPans((prev) => ({ ...prev, [pan.id]: data.pan_number }));
            }
        } finally {
            setRevealingId(null);
        }
    };

    const handleCopy = (panId: number, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(panId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleAddPan = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/pans', {
            user_id: isAdmin ? newPanUserId : auth.user.id,
            pan_number: newPanNumber.toUpperCase().trim(),
            account_holder_name: newHolderName,
            broker_name: newBrokerName,
            notes: newNotes,
        }, {
            onSuccess: () => {
                setIsAddOpen(false);
                setNewPanNumber('');
                setNewHolderName('');
                setNewBrokerName('');
                setNewNotes('');
            },
        });
    };

    const handleOpenEdit = async (pan: UserPan) => {
        setEditingPan(pan);
        setEditUserId(String(pan.user_id));
        setEditHolderName(pan.account_holder_name || '');
        setEditBrokerName(pan.broker_name || '');
        setEditNotes(pan.notes || '');
        setEditStatus(pan.status);

        // Fetch full PAN if not already revealed
        if (revealedPans[pan.id]) {
            setEditPanNumber(revealedPans[pan.id]);
        } else {
            try {
                const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
                const res = await fetch(`/pans/${pan.id}/reveal`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        Accept: 'application/json',
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    setEditPanNumber(data.pan_number);
                    setRevealedPans((prev) => ({ ...prev, [pan.id]: data.pan_number }));
                } else {
                    setEditPanNumber(pan.pan_number || '');
                }
            } catch {
                setEditPanNumber(pan.pan_number || '');
            }
        }
    };

    const handleUpdatePan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPan) return;

        router.put(`/pans/${editingPan.id}`, {
            user_id: isAdmin ? editUserId : editingPan.user_id,
            pan_number: editPanNumber.toUpperCase().trim(),
            account_holder_name: editHolderName,
            broker_name: editBrokerName,
            notes: editNotes,
            status: editStatus,
        }, {
            onSuccess: () => {
                setEditingPan(null);
            },
        });
    };

    const handleToggleStatus = (pan: UserPan) => {
        router.post(`/pans/${pan.id}/toggle`, {}, { preserveScroll: true });
    };

    const handleConfirmDelete = () => {
        if (!deletingPan) return;

        router.delete(`/pans/${deletingPan.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setDeletingPan(null);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="PAN Registry & Security" />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                            PAN Registry & Management
                        </h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Save, edit, and organize investor PAN cards with safe data preservation for IPO bids.
                        </p>
                    </div>

                    <Button onClick={() => setIsAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Saved PAN
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search PAN, holder name, or broker..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange('search', search)}
                            className="pl-9"
                        />
                    </div>

                    {isAdmin && (
                        <Select
                            value={selectedUser}
                            onValueChange={(val) => {
                                setSelectedUser(val);
                                handleFilterChange('user_id', val);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
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

                    {/* View Mode Toggle: Table vs Cards */}
                    <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 bg-neutral-50 dark:bg-neutral-900/50 ml-auto">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 shadow-xs'
                                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                            }`}
                            title="Compact Table View"
                        >
                            <List className="h-3.5 w-3.5" />
                            <span>Table</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                viewMode === 'cards'
                                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 shadow-xs'
                                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                            }`}
                            title="Cards Grid View"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span>Cards</span>
                        </button>
                    </div>
                </div>

                {/* PAN List Display: Table or Cards */}
                {pans.data.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
                        <CreditCard className="mx-auto h-8 w-8 text-neutral-400" />
                        <h3 className="mt-2 text-base font-semibold">No PAN records found</h3>
                        <p className="mt-1 text-sm text-neutral-500">Save your PAN card once and select it effortlessly when bidding.</p>
                        <Button onClick={() => setIsAddOpen(true)} className="mt-4" size="sm">
                            Add PAN Now
                        </Button>
                    </div>
                ) : viewMode === 'table' ? (
                    /* COMPACT TABLE VIEW */
                    <div className="rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-neutral-200 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/50">
                                    <tr>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">PAN Number</th>
                                        <th className="py-3 px-4">Account Holder</th>
                                        <th className="py-3 px-4">Broker / Demat</th>
                                        {isAdmin && <th className="py-3 px-4">Owner</th>}
                                        <th className="py-3 px-4">Notes</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                    {pans.data.map((pan) => {
                                        const isRevealed = Boolean(revealedPans[pan.id]);
                                        const displayedPan = isRevealed ? revealedPans[pan.id] : pan.masked_pan;

                                        return (
                                            <tr key={pan.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        variant={pan.status === 'active' ? 'default' : 'secondary'}
                                                        className={`text-[10px] capitalize font-semibold ${
                                                            pan.status === 'active'
                                                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                                                        }`}
                                                    >
                                                        {pan.status === 'active' && (
                                                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        )}
                                                        {pan.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-sm font-bold tracking-wider text-neutral-900 dark:text-neutral-100">
                                                            {displayedPan}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                                                            onClick={() => handleReveal(pan)}
                                                            disabled={revealingId === pan.id}
                                                            title={isRevealed ? 'Hide PAN' : 'Reveal full PAN'}
                                                        >
                                                            {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        {isRevealed && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                                                                onClick={() => handleCopy(pan.id, revealedPans[pan.id])}
                                                                title="Copy PAN"
                                                            >
                                                                {copiedId === pan.id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                                                        {pan.account_holder_name || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                                                        {pan.broker_name || 'Generic'}
                                                    </span>
                                                </td>
                                                {isAdmin && (
                                                    <td className="py-3 px-4">
                                                        <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                                                            {pan.user?.name || '—'}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="py-3 px-4">
                                                    {pan.notes ? (
                                                        <span className="text-xs text-neutral-500 italic max-w-[180px] truncate block" title={pan.notes}>
                                                            "{pan.notes}"
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-400 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={`h-7 px-2 text-xs ${
                                                                pan.status === 'active'
                                                                    ? 'text-neutral-500 hover:text-amber-600'
                                                                    : 'text-emerald-600 hover:text-emerald-700'
                                                            }`}
                                                            onClick={() => handleToggleStatus(pan)}
                                                            title={pan.status === 'active' ? 'Deactivate PAN' : 'Activate PAN'}
                                                        >
                                                            {pan.status === 'active' ? 'Deactivate' : 'Activate'}
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                                                            onClick={() => handleOpenEdit(pan)}
                                                            title="Edit PAN details"
                                                        >
                                                            <Edit2 className="h-3 w-3 mr-1" /> Edit
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-1.5 text-xs text-neutral-400 hover:text-red-600"
                                                            onClick={() => setDeletingPan(pan)}
                                                            title="Delete PAN"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* CARDS GRID VIEW */
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                        {pans.data.map((pan) => {
                            const isRevealed = Boolean(revealedPans[pan.id]);
                            const displayedPan = isRevealed ? revealedPans[pan.id] : pan.masked_pan;

                            return (
                                <Card key={pan.id} className="relative overflow-hidden flex flex-col justify-between">
                                    <div className={`absolute top-0 left-0 right-0 h-1 ${pan.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                                    <div>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <span className="text-xs text-neutral-500 block">PAN Card</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="font-mono text-lg font-bold tracking-wider text-neutral-900 dark:text-neutral-50">
                                                            {displayedPan}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                                                            onClick={() => handleReveal(pan)}
                                                            disabled={revealingId === pan.id}
                                                            title={isRevealed ? 'Hide PAN' : 'Reveal full PAN'}
                                                        >
                                                            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                        {isRevealed && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                                                                onClick={() => handleCopy(pan.id, revealedPans[pan.id])}
                                                                title="Copy PAN"
                                                            >
                                                                {copiedId === pan.id ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <Badge
                                                    variant={pan.status === 'active' ? 'default' : 'secondary'}
                                                    className="text-[10px] capitalize"
                                                >
                                                    {pan.status}
                                                </Badge>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="space-y-2 text-xs">
                                            <div>
                                                <span className="text-neutral-500 block">Holder Name</span>
                                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                                    {pan.account_holder_name || 'N/A'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                                                <div>
                                                    <span className="text-neutral-500 block">Broker / Demat</span>
                                                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                                        {pan.broker_name || 'Generic'}
                                                    </span>
                                                </div>
                                                {isAdmin && pan.user && (
                                                    <div>
                                                        <span className="text-neutral-500 block">Owner</span>
                                                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                                            {pan.user.name}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {pan.notes && (
                                                <p className="text-neutral-500 italic pt-1 text-[11px]">
                                                    "{pan.notes}"
                                                </p>
                                            )}
                                        </CardContent>
                                    </div>

                                    {/* Action Buttons: Toggle, Edit, Delete */}
                                    <div className="p-3 pt-0 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between mt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-7 text-xs ${
                                                pan.status === 'active'
                                                    ? 'text-neutral-500 hover:text-amber-600'
                                                    : 'text-emerald-600 hover:text-emerald-700'
                                            }`}
                                            onClick={() => handleToggleStatus(pan)}
                                        >
                                            {pan.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                                                onClick={() => handleOpenEdit(pan)}
                                                title="Edit PAN details"
                                            >
                                                <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => setDeletingPan(pan)}
                                                title="Delete PAN"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add PAN Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Save New PAN Card</DialogTitle>
                        <DialogDescription>
                            Enter standard 10-character Indian PAN. Masked by default for privacy.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAddPan} className="space-y-4">
                        {isAdmin && (
                            <div className="space-y-1">
                                <Label htmlFor="user_id">Associate with User *</Label>
                                <Select value={newPanUserId} onValueChange={setNewPanUserId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                                {u.name} ({u.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label htmlFor="pan_number">PAN Number *</Label>
                            <Input
                                id="pan_number"
                                required
                                maxLength={10}
                                placeholder="ABCDE1234F"
                                className="font-mono uppercase tracking-wider"
                                value={newPanNumber}
                                onChange={(e) => setNewPanNumber(e.target.value.toUpperCase())}
                            />
                            <span className="text-[11px] text-neutral-500">Format: 5 letters, 4 digits, 1 letter</span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="holder_name">Account Holder Name</Label>
                            <Input
                                id="holder_name"
                                placeholder="Name as on PAN card"
                                value={newHolderName}
                                onChange={(e) => setNewHolderName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="broker_name">Broker / Demat Reference</Label>
                            <Input
                                id="broker_name"
                                placeholder="e.g. Zerodha, Groww, Angel One"
                                value={newBrokerName}
                                onChange={(e) => setNewBrokerName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="notes">Notes</Label>
                            <Input
                                id="notes"
                                placeholder="e.g. Self demat, Wife's account"
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Save to Registry
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit PAN Modal */}
            <Dialog open={!!editingPan} onOpenChange={() => setEditingPan(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Saved PAN</DialogTitle>
                        <DialogDescription>
                            Update PAN holder details, linked demat broker, or active status.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleUpdatePan} className="space-y-4">
                        {isAdmin && (
                            <div className="space-y-1">
                                <Label htmlFor="edit_pan_user">Assigned User Account *</Label>
                                <Select value={editUserId} onValueChange={setEditUserId}>
                                    <SelectTrigger id="edit_pan_user">
                                        <SelectValue placeholder="Select user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                                {u.name} ({u.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label htmlFor="edit_pan_number">PAN Number *</Label>
                            <Input
                                id="edit_pan_number"
                                required
                                maxLength={10}
                                placeholder="ABCDE1234F"
                                className="font-mono uppercase tracking-wider"
                                value={editPanNumber}
                                onChange={(e) => setEditPanNumber(e.target.value.toUpperCase())}
                            />
                            <span className="text-[11px] text-neutral-500">Format: 5 letters, 4 digits, 1 letter</span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="edit_pan_holder">Account Holder Name</Label>
                            <Input
                                id="edit_pan_holder"
                                placeholder="Name as on PAN card"
                                value={editHolderName}
                                onChange={(e) => setEditHolderName(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="edit_pan_broker">Broker / Demat</Label>
                                <Input
                                    id="edit_pan_broker"
                                    placeholder="e.g. Zerodha, Groww"
                                    value={editBrokerName}
                                    onChange={(e) => setEditBrokerName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="edit_pan_status">Status</Label>
                                <Select value={editStatus} onValueChange={(val: 'active' | 'inactive') => setEditStatus(val)}>
                                    <SelectTrigger id="edit_pan_status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="edit_pan_notes">Notes</Label>
                            <Input
                                id="edit_pan_notes"
                                placeholder="e.g. Family demat account"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingPan(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete PAN Confirmation Modal */}
            <Dialog open={!!deletingPan} onOpenChange={() => setDeletingPan(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <Trash2 className="h-5 w-5" /> Delete PAN Record
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete PAN <strong className="font-mono text-neutral-900 dark:text-neutral-100">{deletingPan?.masked_pan}</strong> ({deletingPan?.account_holder_name || 'No Name'})?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            Data Safety Guaranteed
                        </div>
                        <p className="text-emerald-700 dark:text-emerald-400">
                            This PAN will be removed from your active registry. All historical IPO bids, allotment snapshots, and batch logs containing this PAN remain safe and intact.
                        </p>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => setDeletingPan(null)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmDelete}
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Confirm Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
