import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function IpoCardSkeleton() {
    return (
        <Card className="flex flex-col justify-between border-neutral-200/80 dark:border-neutral-800 shadow-xs animate-pulse">
            <CardHeader className="pb-3 space-y-2">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24 rounded-full" />
                    <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-6 w-3/4 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3 pb-3">
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-md bg-neutral-50 dark:bg-neutral-900/50">
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-18" />
                        <Skeleton className="h-4 w-22" />
                    </div>
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-18" />
                    </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-14" />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <Skeleton className="h-9 w-full rounded-md" />
            </CardFooter>
        </Card>
    );
}

export function IpoGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <IpoCardSkeleton key={i} />
            ))}
        </div>
    );
}

export function IpoTableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 overflow-hidden animate-pulse">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-7 w-20 rounded-md" />
                    </div>
                ))}
            </div>
        </div>
    );
}
