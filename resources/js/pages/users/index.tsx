import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Edit2,
    Plus,
    RotateCcw,
    Search,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    UserCheck,
    UserX,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { BreadcrumbItem, User } from '@/types';

interface UsersIndexProps {
    users: {
        data: (User & { pans_count?: number; application_batches_count?: number; deleted_at?: string | null })[];
        current_page: number;
        last_page: number;
        total: number;
    };
    filters: {
        search?: string;
        role?: string;
        status?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users & Friends',
        href: '/users',
    },
];

export default function UsersIndex({ users, filters }: UsersIndexProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;

    const [search, setSearch] = useState(filters.search || '');
    const [roleFilter, setRoleFilter] = useState(filters.role || 'all');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');

    // Modals
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<(User & { pans_count?: number; application_batches_count?: number }) | null>(null);
    const [deletingUser, setDeletingUser] = useState<(User & { pans_count?: number; application_batches_count?: number }) | null>(null);
    const [keepDataSafe, setKeepDataSafe] = useState(true);

    // Form state for add/edit
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'admin' | 'user'>('user');
    const [status, setStatus] = useState<'active' | 'inactive' | 'archived'>('active');
    const [password, setPassword] = useState('');

    const handleFilterChange = (key: string, value: string) => {
        const query: Record<string, string> = {
            search,
            role: roleFilter,
            status: statusFilter,
            [key]: value,
        };

        if (query.role === 'all' || !query.role) delete query.role;
        if (query.status === 'all' || !query.status) delete query.status;
        if (!query.search) delete query.search;

        router.get('/users', query, { preserveState: true, replace: true });
    };

    const handleCreateUser = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/users', {
            name,
            email,
            phone,
            role,
            password,
        }, {
            onSuccess: () => {
                setIsAddOpen(false);
                setName('');
                setEmail('');
                setPhone('');
                setPassword('');
            },
        });
    };

    const handleEditUser = (user: User & { pans_count?: number; application_batches_count?: number }) => {
        setEditingUser(user);
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone || '');
        setRole(user.role);
        setStatus(user.status);
        setPassword('');
    };

    const handleUpdateUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        router.put(`/users/${editingUser.id}`, {
            name,
            email,
            phone,
            role,
            status,
            password: password || undefined,
        }, {
            onSuccess: () => {
                setEditingUser(null);
            },
        });
    };

    const handleToggleStatus = (u: User) => {
        if (auth.user.id === u.id) return;
        router.post(`/users/${u.id}/toggle`, {}, { preserveScroll: true });
    };

    const handleRestoreUser = (u: User) => {
        router.post(`/users/${u.id}/restore`, {}, { preserveScroll: true });
    };

    const handleOpenDelete = (u: User & { pans_count?: number; application_batches_count?: number }) => {
        setDeletingUser(u);
        setKeepDataSafe(true); // Default to keeping data safe
    };

    const handleConfirmDelete = () => {
        if (!deletingUser) return;

        router.delete(`/users/${deletingUser.id}`, {
            data: { keep_data_safe: keepDataSafe },
            onSuccess: () => {
                setDeletingUser(null);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Friends & Users Management" />

            <div className="flex flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                            Friends & User Accounts
                        </h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Manage user profiles, toggle active status, edit details, and securely archive accounts with data protection.
                        </p>
                    </div>

                    <Button onClick={() => setIsAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Add New Friend / User
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search user name, email, or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange('search', search)}
                            className="pl-9"
                        />
                    </div>

                    <Select
                        value={roleFilter}
                        onValueChange={(val) => {
                            setRoleFilter(val);
                            handleFilterChange('role', val);
                        }}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">User (Friend)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={statusFilter}
                        onValueChange={(val) => {
                            setStatusFilter(val);
                            handleFilterChange('status', val);
                        }}
                    >
                        <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status (All)</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="archived">Archived / Protected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Users Table */}
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
                                    <tr>
                                        <th className="py-3 px-3 w-12 text-center">#</th>
                                        <th className="py-3 px-4">Name</th>
                                        <th className="py-3 px-4">Email</th>
                                        <th className="py-3 px-4">Phone</th>
                                        <th className="py-3 px-4">Role</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Saved PANs</th>
                                        <th className="py-3 px-4">Applications</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                    {users.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-neutral-500">
                                                No users found matching your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        users.data.map((u, index) => {
                                            const rowNumber = (users.current_page - 1) * 15 + index + 1;
                                            const isSelf = auth.user.id === u.id;
                                            const isArchived = u.status === 'archived' || Boolean(u.deleted_at);

                                            return (
                                                <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                                                    <td className="py-3 px-3 text-center text-xs font-mono text-neutral-400 dark:text-neutral-500 font-semibold">
                                                        {rowNumber}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-semibold text-neutral-900 dark:text-neutral-50 flex items-center gap-1.5">
                                                            {u.name}
                                                            {isSelf && (
                                                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                                                    You
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                                                        {u.email}
                                                    </td>
                                                    <td className="py-3 px-4 text-neutral-500 font-mono text-xs">
                                                        {u.phone || '—'}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                                                            {u.role}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {isArchived ? (
                                                            <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400">
                                                                Archived / Protected
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                className={`text-[10px] capitalize ${
                                                                    u.status === 'active'
                                                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                                        : 'bg-neutral-500/10 text-neutral-600 border-neutral-500/20'
                                                                }`}
                                                            >
                                                                {u.status}
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="font-semibold">{u.pans_count || 0}</span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="font-semibold">{u.application_batches_count || 0}</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isArchived ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-300"
                                                                    onClick={() => handleRestoreUser(u)}
                                                                    title="Restore archived account"
                                                                >
                                                                    <RotateCcw className="h-3 w-3 mr-1" /> Restore
                                                                </Button>
                                                            ) : (
                                                                <>
                                                                    {/* 1-Click Activate / Deactivate Toggle */}
                                                                    {!isSelf && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className={`h-7 text-xs ${
                                                                                u.status === 'active'
                                                                                    ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                                                                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                                                            }`}
                                                                            onClick={() => handleToggleStatus(u)}
                                                                            title={u.status === 'active' ? 'Deactivate user' : 'Activate user'}
                                                                        >
                                                                            {u.status === 'active' ? (
                                                                                <>
                                                                                    <UserX className="h-3.5 w-3.5 mr-1" /> Deactivate
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Activate
                                                                                </>
                                                                            )}
                                                                        </Button>
                                                                    )}

                                                                    {/* Edit Button */}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 text-xs text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                                                                        onClick={() => handleEditUser(u)}
                                                                    >
                                                                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                                                                    </Button>

                                                                    {/* Delete Button */}
                                                                    {!isSelf && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                            onClick={() => handleOpenDelete(u)}
                                                                            title="Delete user account"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Create User Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Friend / User</DialogTitle>
                        <DialogDescription>
                            Create an account for your friend to view rates and track their IPO applications.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="user_name">Full Name *</Label>
                            <Input
                                id="user_name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="user_email">Email Address *</Label>
                            <Input
                                id="user_email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="user_phone">Phone (Optional)</Label>
                                <Input
                                    id="user_phone"
                                    placeholder="+91..."
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="user_role">Role *</Label>
                                <Select value={role} onValueChange={(val: 'admin' | 'user') => setRole(val)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User (Friend)</SelectItem>
                                        <SelectItem value="admin">Administrator</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="user_password">Password *</Label>
                            <Input
                                id="user_password"
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Create Account
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Modal */}
            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User: {editingUser?.name}</DialogTitle>
                        <DialogDescription>
                            Update personal details, permissions, or account status.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleUpdateUser} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="edit_name">Full Name *</Label>
                            <Input
                                id="edit_name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="edit_email">Email Address *</Label>
                            <Input
                                id="edit_email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="edit_role">Role</Label>
                                <Select value={role} onValueChange={(val: 'admin' | 'user') => setRole(val)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="edit_status">Status</Label>
                                <Select value={status} onValueChange={(val: 'active' | 'inactive' | 'archived') => setStatus(val)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="edit_phone">Phone (Optional)</Label>
                            <Input
                                id="edit_phone"
                                placeholder="+91..."
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="edit_password">New Password (leave blank to keep current)</Label>
                            <Input
                                id="edit_password"
                                type="password"
                                minLength={8}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete User Modal with Safe Data Protection Option */}
            <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-5 w-5" /> Delete User Account
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove account for <strong className="text-neutral-900 dark:text-neutral-100">{deletingUser?.name}</strong> ({deletingUser?.email})?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Checkbox for Data Protection */}
                        <div className="flex items-start space-x-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                            <Checkbox
                                id="keep_safe_check"
                                checked={keepDataSafe}
                                onCheckedChange={(val) => setKeepDataSafe(Boolean(val))}
                                className="mt-1 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                            />
                            <div className="space-y-1 leading-none">
                                <label
                                    htmlFor="keep_safe_check"
                                    className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 cursor-pointer"
                                >
                                    Keep user's application history and financial records safe (Archive & Protect)
                                </label>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Recommended: Soft-deletes user while securing all historical records.
                                </p>
                            </div>
                        </div>

                        {/* Explanation based on checkbox */}
                        {keepDataSafe ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    Safe Archive Protection Active
                                </div>
                                <ul className="list-disc pl-4 space-y-1 text-emerald-700 dark:text-emerald-400">
                                    <li>
                                        <strong>{deletingUser?.application_batches_count || 0} IPO application batches</strong> and historical financial records remain 100% intact.
                                    </li>
                                    <li>
                                        <strong>{deletingUser?.pans_count || 0} saved PAN cards</strong> and allotment history snapshots remain preserved.
                                    </li>
                                    <li>Account login will be deactivated immediately.</li>
                                    <li>You can restore and reactivate this user account at any time.</li>
                                </ul>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                                <div className="flex items-center gap-1.5 font-semibold text-red-900 dark:text-red-200 mb-1">
                                    <ShieldAlert className="h-4 w-4 text-red-600" />
                                    Permanent Account Deletion Warning
                                </div>
                                <p className="mb-1 text-red-700 dark:text-red-400">
                                    This will permanently remove the user and their saved PANs from the database.
                                </p>
                                {(deletingUser?.application_batches_count || 0) > 0 && (
                                    <p className="font-semibold text-red-900 dark:text-red-200 bg-red-100 dark:bg-red-900/40 p-2 rounded mt-2">
                                        Blocked: This user has {deletingUser?.application_batches_count} existing application batches. Permanent deletion is not allowed to prevent data corruption. Please keep the "Archive & Protect" option selected.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => setDeletingUser(null)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant={keepDataSafe ? 'default' : 'destructive'}
                            className={keepDataSafe ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                            onClick={handleConfirmDelete}
                        >
                            {keepDataSafe ? (
                                <>
                                    <ShieldCheck className="h-4 w-4 mr-1.5" />
                                    Archive & Delete Safely
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                    Permanently Delete
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
