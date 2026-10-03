import { Link, usePage } from '@inertiajs/react';
import {
    CreditCard,
    FileText,
    LayoutGrid,
    RefreshCw,
    ShieldAlert,
    TrendingUp,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem, User } from '@/types';

export function AppSidebar() {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const isAdmin = auth.user?.role === 'admin';

    const adminNavItems: NavItem[] = [
        {
            title: 'Dashboard',
            href: '/dashboard',
            icon: LayoutGrid,
        },
        {
            title: 'IPO Listings',
            href: '/ipos',
            icon: TrendingUp,
        },
        {
            title: 'Applications',
            href: '/applications',
            icon: FileText,
        },
        {
            title: 'PAN Registry',
            href: '/pans',
            icon: CreditCard,
        },
        {
            title: 'Friends & Users',
            href: '/users',
            icon: Users,
        },
        {
            title: 'Provider & Sync',
            href: '/sync',
            icon: RefreshCw,
        },
        {
            title: 'Audit Logs',
            href: '/audit-logs',
            icon: ShieldAlert,
        },
    ];

    const userNavItems: NavItem[] = [
        {
            title: 'Dashboard',
            href: '/dashboard',
            icon: LayoutGrid,
        },
        {
            title: 'Current IPOs',
            href: '/ipos',
            icon: TrendingUp,
        },
        {
            title: 'My Applications',
            href: '/applications',
            icon: FileText,
        },
        {
            title: 'My Saved PANs',
            href: '/pans',
            icon: CreditCard,
        },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={isAdmin ? adminNavItems : userNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
