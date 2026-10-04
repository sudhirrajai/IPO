import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { PageLoader } from '@/components/page-loader';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="min-w-0 overflow-x-clip relative flex flex-col min-h-screen">
                <PageLoader />
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <main className="flex-1 pb-24 md:pb-6">
                    {children}
                </main>
                <MobileBottomNav />
            </AppContent>
        </AppShell>
    );
}
