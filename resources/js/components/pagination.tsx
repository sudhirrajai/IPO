import { Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export interface PaginatorMeta {
    current_page: number;
    last_page: number;
    total: number;
    per_page?: number;
    from?: number | null;
    to?: number | null;
    links?: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
}

interface PaginationProps {
    data: PaginatorMeta;
    itemName?: string;
    showPerPage?: boolean;
    perPageOptions?: number[];
    onPerPageChange?: (perPage: string) => void;
    className?: string;
}

export default function Pagination({
    data,
    itemName = 'items',
    showPerPage = true,
    perPageOptions = [15, 25, 50, 100],
    onPerPageChange,
    className = '',
}: PaginationProps) {
    const { current_page, last_page, total, per_page, from, to, links = [] } = data;

    if (total === 0) return null;

    const handlePerPageChange = (val: string) => {
        if (onPerPageChange) {
            onPerPageChange(val);
            return;
        }

        const currentUrl = new URL(window.location.href);
        if (val === 'all') {
            currentUrl.searchParams.set('per_page', '500');
        } else {
            currentUrl.searchParams.set('per_page', val);
        }
        currentUrl.searchParams.delete('page');
        router.get(currentUrl.pathname + currentUrl.search, {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 rounded-b-xl ${className}`}>
            {/* Left: Summary and Per Page Selector */}
            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span>
                    Showing{' '}
                    <strong className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {from ?? 1}
                    </strong>{' '}
                    to{' '}
                    <strong className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {to ?? total}
                    </strong>{' '}
                    of{' '}
                    <strong className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {total}
                    </strong>{' '}
                    {itemName}
                </span>

                {showPerPage && total > 15 && (
                    <div className="flex items-center gap-1.5 ml-2">
                        <span>Show:</span>
                        <Select
                            value={String(per_page || 15)}
                            onValueChange={handlePerPageChange}
                        >
                            <SelectTrigger className="h-7 w-[70px] text-xs font-mono">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {perPageOptions.map((opt) => (
                                    <SelectItem key={opt} value={String(opt)} className="text-xs font-mono">
                                        {opt}
                                    </SelectItem>
                                ))}
                                <SelectItem value="all" className="text-xs">
                                    All
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Right: Page Navigation Links */}
            {last_page > 1 && (
                <div className="flex items-center gap-1">
                    {links.map((link, idx) => {
                        const isPrev = link.label.includes('&laquo;') || link.label.toLowerCase().includes('prev');
                        const isNext = link.label.includes('&raquo;') || link.label.toLowerCase().includes('next');
                        const isDots = link.label === '...';

                        if (isDots) {
                            return (
                                <span
                                    key={idx}
                                    className="px-2 py-1 text-xs text-neutral-400"
                                >
                                    ...
                                </span>
                            );
                        }

                        if (!link.url) {
                            return (
                                <Button
                                    key={idx}
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="h-8 px-2 text-xs opacity-40 cursor-not-allowed"
                                >
                                    {isPrev ? <ChevronLeft className="h-3.5 w-3.5" /> : isNext ? <ChevronRight className="h-3.5 w-3.5" /> : link.label}
                                </Button>
                            );
                        }

                        return (
                            <Link
                                key={idx}
                                href={link.url}
                                preserveScroll
                                preserveState
                                replace
                            >
                                <Button
                                    variant={link.active ? 'default' : 'outline'}
                                    size="sm"
                                    className={`h-8 px-2.5 text-xs font-medium ${
                                        link.active
                                            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                    }`}
                                >
                                    {isPrev ? (
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                    ) : isNext ? (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    ) : (
                                        link.label
                                    )}
                                </Button>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
