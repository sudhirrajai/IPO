<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\SyncLog;
use App\Services\IpoSyncService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IpoSyncController extends Controller
{
    public function index(): Response
    {
        $currentProvider = AppSetting::get('ipo_provider', 'mock');
        $logs = SyncLog::with('triggeredBy')
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        $credentials = [
            'ipoalerts_api_key' => AppSetting::get('ipoalerts_api_key', config('services.ipoalerts.api_key', '')),
            'upstox_api_key' => AppSetting::get('upstox_api_key', config('services.upstox.api_key', '')),
            'upstox_access_token' => AppSetting::get('upstox_access_token', config('services.upstox.access_token', '')),
        ];

        $gmpStatsRaw = AppSetting::get('last_gmp_scrape_stats');
        $lastGmpStats = $gmpStatsRaw ? json_decode($gmpStatsRaw, true) : null;

        return Inertia::render('sync/index', [
            'currentProvider' => $currentProvider,
            'credentials' => $credentials,
            'lastGmpScrapeAt' => AppSetting::get('last_gmp_scrape_at'),
            'lastGmpStats' => $lastGmpStats,
            'logs' => $logs,
        ]);
    }

    public function sync(Request $request): RedirectResponse
    {
        $provider = $request->input('provider') ?: AppSetting::get('ipo_provider', 'mock');

        $log = IpoSyncService::sync($provider);

        if ($log->status === 'success') {
            return back()->with('success', "Sync successful: {$log->ipos_created} created, {$log->ipos_updated} updated in {$log->execution_time_ms}ms.");
        }

        return back()->with('error', "Sync failed: {$log->error_message}");
    }

    public function scrapeGmp(\App\Services\GmpScraperService $gmpScraper): RedirectResponse
    {
        $result = $gmpScraper->syncGmpData();

        if ($result['success']) {
            return back()->with('success', "InvestorGain Live GMP scraped successfully: {$result['matched_count']} IPOs matched, {$result['updated_count']} updated in {$result['duration_ms']}ms.");
        }

        return back()->with('error', "GMP scrape failed: {$result['message']}");
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ipo_provider' => 'nullable|in:mock,ipoalerts,upstox',
            'ipoalerts_api_key' => 'nullable|string|max:255',
            'upstox_api_key' => 'nullable|string|max:255',
            'upstox_access_token' => 'nullable|string|max:4000',
        ]);

        if (! empty($validated['ipo_provider'])) {
            AppSetting::set('ipo_provider', $validated['ipo_provider']);
        }

        if (array_key_exists('ipoalerts_api_key', $validated)) {
            AppSetting::set('ipoalerts_api_key', $validated['ipoalerts_api_key']);
        }

        if (array_key_exists('upstox_api_key', $validated)) {
            AppSetting::set('upstox_api_key', $validated['upstox_api_key']);
        }

        if (array_key_exists('upstox_access_token', $validated)) {
            AppSetting::set('upstox_access_token', $validated['upstox_access_token']);
        }

        return back()->with('success', 'Provider settings and API credentials saved successfully.');
    }
}
