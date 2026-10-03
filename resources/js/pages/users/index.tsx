import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    CreditCard,
    Edit2,
    FileText,
    Plus,
    Search,
    UserCheck,
    UserX,
    Users,
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
import type { BreadcrumbItem, User } from '@/types';

interface UsersIndexProps {
    users: {
        data: (User & { pans_count?: number; application_batches_count?: number })[];
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
    const [search, setSearch] = useState(filters.search || '');
    const [roleFilter, setRoleFilter] = useState(filters.role || 'all');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'admin' | 'user'>('user');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
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

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone || '');
        setRole(user.role);
        setStatus(user.status as 'active' | 'inactive');
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
                            Invite friends, configure role permissions, and track active investor profiles.
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
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Users Table */}
                <Card>
                    <CardContent className="p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50">
                                <tr>
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
                                {users.data.map((u) => (
                                    <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                                        <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-neutral-50">
                                            {u.name}
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
                                            <Badge
                                                className={`text-[10px] capitalize ${
                                                    u.status === 'active'
                                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                        : 'bg-neutral-500/10 text-neutral-600 border-neutral-500/20'
                                                }`}
                                            >
                                                {u.status}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="font-semibold">{u.pans_count || 0}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="font-semibold">{u.application_batches_count || 0}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => handleEditUser(u)}
                                            >
                                                <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                <Select value={status} onValueChange={(val: 'active' | 'inactive') => setStatus(val)}>
                                    <SelectTrigger>
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
        </AppLayout>
    );
}
