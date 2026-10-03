import { router, usePage } from '@inertiajs/react';
import { AlertCircle, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export function PageLoader() {
    const { props } = usePage<{ flash?: { error?: string | null; success?: string | null; info?: string | null } }>();
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showFullLoader, setShowFullLoader] = useState(false);
    const [loadingText, setLoadingText] = useState('Loading IPO & market data...');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fullLoaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync with flash error if present
    useEffect(() => {
        if (props.flash?.error) {
            setErrorMessage(props.flash.error);
            setIsLoading(false);
            setShowFullLoader(false);
        }
    }, [props.flash?.error]);

    useEffect(() => {
        const removeStart = router.on('start', (event) => {
            setIsLoading(true);
            setProgress(15);
            setErrorMessage(null);

            // Dynamically customize text based on URL or action
            const url = event?.detail?.visit?.url?.pathname || '';
            if (url.includes('/sync')) {
                setLoadingText('Synchronizing IPO feeds & live market data...');
            } else if (url.includes('/applications')) {
                setLoadingText('Processing application & calculating profit shares...');
            } else if (url.includes('/pans')) {
                setLoadingText('Securing & loading PAN registry...');
            } else {
                setLoadingText('Loading IPO workspace & live metrics...');
            }

            // Show full circular loader if request takes longer than 90ms
            fullLoaderTimerRef.current = setTimeout(() => {
                setShowFullLoader(true);
            }, 90);

            // Incremental progress simulation for top line
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setProgress((prev) => {
                    if (prev < 40) return prev + 14;
                    if (prev < 70) return prev + 7;
                    if (prev < 88) return prev + 2;
                    return prev;
                });
            }, 120);
        });

        const removeFinish = router.on('finish', () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (fullLoaderTimerRef.current) clearTimeout(fullLoaderTimerRef.current);
            setProgress(100);

            setTimeout(() => {
                setShowFullLoader(false);
                setIsLoading(false);
                setProgress(0);
            }, 150);
        });

        const removeError = router.on('error', (errors) => {
            // EXIT loader immediately on error
            if (timerRef.current) clearInterval(timerRef.current);
            if (fullLoaderTimerRef.current) clearTimeout(fullLoaderTimerRef.current);
            setShowFullLoader(false);
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
            if (fullLoaderTimerRef.current) clearTimeout(fullLoaderTimerRef.current);
            setShowFullLoader(false);
            setIsLoading(false);
            setProgress(0);
        });

        return () => {
            removeStart();
            removeFinish();
            removeError();
            removeCancel();
            if (timerRef.current) clearInterval(timerRef.current);
            if (fullLoaderTimerRef.current) clearTimeout(fullLoaderTimerRef.current);
        };
    }, []);

    return (
        <>
            {/* Top Loading Precision Progress Bar */}
            {isLoading && (
                <div className="fixed top-0 left-0 right-0 z-[10000] h-1 bg-transparent pointer-events-none overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all duration-120 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Full-Page Circular Glowing Loader Overlay */}
            {isLoading && showFullLoader && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-950/30 dark:bg-black/55 backdrop-blur-[3px] transition-all duration-200 animate-in fade-in"
                >
                    <div className="relative flex items-center justify-center">
                        {/* Outer pulsing ping wave */}
                        <div className="absolute h-24 w-24 rounded-full border border-emerald-500/20 dark:border-emerald-400/25 animate-ping opacity-30" />

                        {/* Outer glowing multi-color circular ring */}
                        <div className="h-16 w-16 rounded-full border-3 border-neutral-200/20 border-t-emerald-500 border-r-teal-400 border-b-blue-500 dark:border-neutral-700/30 dark:border-t-emerald-400 animate-spin" />

                        {/* Inner counter-spinning dashed ring */}
                        <div className="absolute h-10 w-10 rounded-full border-2 border-transparent border-b-emerald-400 border-l-teal-300 dark:border-b-emerald-300 dark:border-l-teal-200 animate-[spin_1.4s_linear_infinite_reverse]" />

                        {/* Center core pulsing dot */}
                        <div className="absolute flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.8)]">
                            <span className="relative flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        </div>
                    </div>

                    {/* Status Floating Pill */}
                    <div className="mt-5 flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-neutral-900/95 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-medium tracking-wide text-neutral-800 dark:text-neutral-200">
                            {loadingText}
                        </span>
                    </div>
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
