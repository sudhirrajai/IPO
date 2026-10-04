import { Link } from '@inertiajs/react';
import { CreditCard, FileText, LayoutDashboard, TrendingUp } from 'lucide-react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';

interface NavItem {
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    match: (path: string) => boolean;
}

export function MobileBottomNav() {
    const { currentUrl } = useCurrentUrl();

    const navItems: NavItem[] = [
        {
            name: 'Home',
            href: '/dashboard',
            icon: LayoutDashboard,
            match: (path) => path === '/dashboard' || path === '/',
        },
        {
            name: 'IPOs',
            href: '/ipos',
            icon: TrendingUp,
            match: (path) => path.startsWith('/ipos'),
        },
        {
            name: 'Applications',
            href: '/applications',
            icon: FileText,
            match: (path) => path.startsWith('/applications'),
        },
        {
            name: 'My PANs',
            href: '/pans',
            icon: CreditCard,
            match: (path) => path.startsWith('/pans'),
        },
    ];

    return (
        <nav
            aria-label="Mobile Navigation"
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-neutral-200/80 bg-white/95 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:border-neutral-800/80 dark:bg-neutral-950/95 transition-all"
        >
            <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.match(currentUrl);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch
                            className={cn(
                                'relative flex flex-1 flex-col items-center justify-center py-1.5 text-[11px] font-medium transition-all duration-150 active:scale-95',
                                isActive
                                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                            )}
                        >
                            {/* Active Top Bar Indicator */}
                            {isActive && (
                                <span className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                            )}

                            <div
                                className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                                    isActive
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                        : 'bg-transparent'
                                )}
                            >
                                <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.25]')} />
                            </div>
                            <span className="mt-0.5 tracking-tight truncate max-w-[70px]">
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

export default MobileBottomNav;
