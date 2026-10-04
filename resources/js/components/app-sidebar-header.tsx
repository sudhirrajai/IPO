import { Link, router, usePage } from '@inertiajs/react';
import {
    CreditCard,
    FileText,
    LogOut,
    Moon,
    Shield,
    Sparkles,
    User as UserIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useInitials } from '@/hooks/use-initials';
import { logout } from '@/routes';
import { edit as editProfile } from '@/routes/profile';
import type { BreadcrumbItem as BreadcrumbItemType, User } from '@/types';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const page = usePage<{ auth: { user: User } }>();
    const user = page.props.auth?.user;
    const getInitials = useInitials();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Detect if app is already running in standalone PWA mode
        if (
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as unknown as { standalone?: boolean }).standalone === true
        ) {
            setIsInstalled(true);
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
    };

    const handleLogout = () => {
        router.flushAll();
    };

    const isAdmin = user?.role === 'admin';

    return (
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border/60 bg-background/95 px-4 backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-6">
            {/* Left side: Navigation / Breadcrumbs */}
            <div className="flex items-center gap-2 overflow-hidden pr-2">
                <SidebarTrigger className="-ml-1 h-9 w-9 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100" />
                <div className="overflow-hidden">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            </div>

            {/* Right side: PWA Install & Profile Navigation */}
            <div className="flex items-center gap-2">
                {/* PWA Install Button (shows when installable) */}
                {deferredPrompt && !isInstalled && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleInstallClick}
                        className="hidden sm:inline-flex h-8 items-center gap-1.5 border-emerald-500/30 bg-emerald-50/50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                    >
                        <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-spin" />
                        Install App
                    </Button>
                )}

                {/* Profile Avatar Dropdown */}
                {user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="group relative flex items-center gap-2 rounded-full p-0.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-95"
                                aria-label="User navigation profile"
                            >
                                <Avatar className="h-9 w-9 border-2 border-emerald-500/30 shadow-sm transition-transform group-hover:scale-105">
                                    <AvatarImage src={user.avatar} alt={user.name} />
                                    <AvatarFallback className="bg-emerald-600 text-xs font-bold text-white">
                                        {getInitials(user.name || 'User')}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Online status dot */}
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent className="w-64 p-2 shadow-xl" align="end" sideOffset={8}>
                            {/* User Header Details */}
                            <DropdownMenuLabel className="p-2 font-normal">
                                <div className="flex flex-col space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold leading-none text-neutral-900 dark:text-neutral-100">
                                            {user.name}
                                        </p>
                                        <Badge
                                            className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 ${
                                                isAdmin
                                                    ? 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:bg-purple-950/40 dark:text-purple-300'
                                                    : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300'
                                            }`}
                                        >
                                            {isAdmin ? 'Admin' : 'User / Friend'}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                        {user.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>

                            <DropdownMenuSeparator />

                            {/* Direct Navigation Links */}
                            <DropdownMenuGroup>
                                <DropdownMenuItem asChild>
                                    <Link
                                        href={editProfile()}
                                        prefetch
                                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md"
                                    >
                                        <UserIcon className="h-4 w-4 text-neutral-500" />
                                        Profile Settings
                                    </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/applications"
                                        prefetch
                                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md"
                                    >
                                        <FileText className="h-4 w-4 text-neutral-500" />
                                        My Applications
                                    </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/pans"
                                        prefetch
                                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md"
                                    >
                                        <CreditCard className="h-4 w-4 text-neutral-500" />
                                        My PAN Registry
                                    </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/settings/appearance"
                                        prefetch
                                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md"
                                    >
                                        <Moon className="h-4 w-4 text-neutral-500" />
                                        Appearance & Theme
                                    </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/settings/security"
                                        prefetch
                                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md"
                                    >
                                        <Shield className="h-4 w-4 text-neutral-500" />
                                        Security & Password
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>

                            <DropdownMenuSeparator />

                            {/* Logout Action */}
                            <DropdownMenuItem asChild>
                                <Link
                                    className="flex w-full items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 cursor-pointer rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    href={logout()}
                                    as="button"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="h-4 w-4 text-rose-500" />
                                    Log out
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </header>
    );
}

export default AppSidebarHeader;
