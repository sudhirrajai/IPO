import { router, usePage } from '@inertiajs/react';
import { AlertCircle, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export function PageLoader() {
    const { props } = usePage<{ flash?: { error?: string | null; success?: string | null; info?: string | null } }>();
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync with flash error if present
    useEffect(() => {
        if (props.flash?.error) {
            setErrorMessage(props.flash.error);
            setIsLoading(false);
        }
    }, [props.flash?.error]);

    useEffect(() => {
        const removeStart = router.on('start', (event) => {
            // Ignore background prefetch visits completely so hovering does not trigger loader
            if ((event?.detail?.visit as any)?.prefetch) {
                return;
            }

            setIsLoading(true);
            setProgress(20);
            setErrorMessage(null);

            // Incremental progress simulation for top line
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setProgress((prev) => {
                    if (prev < 40) return prev + 15;
                    if (prev < 75) return prev + 8;
                    if (prev < 90) return prev + 2;
                    return prev;
                });
            }, 100);
        });

        const removeFinish = router.on('finish', () => {
            if (timerRef.current) clearInterval(timerRef.current);
            setProgress(100);

            setTimeout(() => {
                setIsLoading(false);
                setProgress(0);
            }, 180);
        });

        const removeError = router.on('error', (errors) => {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsLoading(false);
            setProgress(0);

            // Format errors into readable message
            let msg = 'An error occurred during the request.';
            if (typeof errors === 'object' && errors !== null) {
                const values = Object.values(errors);
                if (values.length > 0) {
                    msg = values.join(' ');
                }
            } else if (typeof errors === 'string') {
                msg = errors;
            }
            setErrorMessage(msg);
        });

        const removeCancel = router.on('cancel', () => {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsLoading(false);
            setProgress(0);
        });

        return () => {
            removeStart();
            removeFinish();
            removeError();
            removeCancel();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <>
            {/* Top Loading Precision Progress Bar */}
            {isLoading && (
                <div className="fixed top-0 left-0 right-0 z-[10000] h-1 bg-transparent pointer-events-none overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all duration-150 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Error Alert Display on the page */}
            {errorMessage && (
                <div className="mx-6 mt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="relative flex items-start gap-3 p-4 text-sm text-red-800 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800/80 shadow-sm">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 pr-6">
                            <span className="font-semibold block">Action could not be completed:</span>
                            <span className="text-xs text-red-700 dark:text-red-300/90 leading-relaxed block mt-0.5">
                                {errorMessage}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMessage(null)}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-200 p-1 transition-colors"
                            title="Dismiss error"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

