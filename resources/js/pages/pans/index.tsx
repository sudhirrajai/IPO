import { Head, router, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    Copy,
    CreditCard,
    Eye,
    EyeOff,
    Filter,
    Plus,
    Search,
    ShieldCheck,
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
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Revealed PAN numbers cache { panId: fullPanString }
    const [revealedPans, setRevealedPans] = useState<Record<number, string>>({});
    const [revealingId, setRevealingId] = useState<number | null>(null);

    // Add PAN form
    const [newPanUserId, setNewPanUserId] = useState(isAdmin ? (users[0]?.id ? String(users[0].id) : '') : String(auth.user.id));
    const [newPanNumber, setNewPanNumber] = useState('');
    const [newHolderName, setNewHolderName] = useState('');
    const [newBrokerName, setNewBrokerName] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);

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
            // Hide it again
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

    const handleToggleStatus = (pan: UserPan) => {
        router.post(`/pans/${pan.id}/toggle`);
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
                            Securely save and reuse PAN cards for high-speed IPO batch submissions.
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
                </div>

                {/* PAN Cards Grid */}
                {pans.data.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
                        <CreditCard className="mx-auto h-8 w-8 text-neutral-400" />
                        <h3 className="mt-2 text-base font-semibold">No PAN records found</h3>
                        <p className="mt-1 text-sm text-neutral-500">Save your PAN card once and select it effortlessly when bidding.</p>
                        <Button onClick={() => setIsAddOpen(true)} className="mt-4" size="sm">
                            Add PAN Now
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {pans.data.map((pan) => {
                            const isRevealed = Boolean(revealedPans[pan.id]);
                            const displayedPan = isRevealed ? revealedPans[pan.id] : pan.masked_pan;

                            return (
                                <Card key={pan.id} className="relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
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
                                                        className="h-7 w-7 text-neutral-500 hover:text-neutral-900"
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
                                                            className="h-7 w-7 text-neutral-500 hover:text-neutral-900"
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

                                        <div className="pt-2 flex justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[11px] text-neutral-400 hover:text-neutral-700"
                                                onClick={() => handleToggleStatus(pan)}
                                            >
                                                {pan.status === 'active' ? 'Deactivate' : 'Activate'}
                                            </Button>
                                        </div>
                                    </CardContent>
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
        </AppLayout>
    );
}
