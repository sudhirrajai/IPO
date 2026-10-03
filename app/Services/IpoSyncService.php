<?php

namespace App\Services;

use App\Contracts\IpoProviderInterface;
use App\Models\AppSetting;
use App\Models\Ipo;
use App\Models\SyncLog;
use App\Services\Providers\IpoAlertsProvider;
use App\Services\Providers\MockIpoProvider;
use App\Services\Providers\UpstoxProvider;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class IpoSyncService
{
    /**
     * Resolve provider by identifier.
     */
    public static function resolveProvider(?string $providerName = null): IpoProviderInterface
    {
        $name = $providerName ?: AppSetting::get('ipo_provider', 'mock');

        return match (strtolower((string) $name)) {
            'ipoalerts' => new IpoAlertsProvider,
            'upstox' => new UpstoxProvider,
            default => new MockIpoProvider,
        };
    }

    /**
     * Run synchronization and record log.
     */
    public static function sync(?string $providerName = null): SyncLog
    {
        $startTime = microtime(true);
        $provider = self::resolveProvider($providerName);
        $name = $provider->getName();

        $createdCount = 0;
        $updatedCount = 0;
        $errorMessage = null;
        $status = 'success';

        try {
            $iposData = $provider->fetchIpos();

            DB::transaction(function () use ($iposData, $name, &$createdCount, &$updatedCount) {
                foreach ($iposData as $data) {
                    $providerId = $data['provider_id'] ?? null;
                    $symbol = $data['symbol'] ?? null;

                    // Match existing IPO by provider_id or symbol
                    $existing = null;
                    if ($providerId) {
                        $existing = Ipo::where('provider', $name)
                            ->where('provider_id', $providerId)
                            ->first();
                    }
                    if (! $existing && $symbol) {
                        $existing = Ipo::where('symbol', $symbol)->first();
                    }

                    $fieldsToUpdate = [
                        'company_name' => $data['company_name'],
                        'symbol' => $symbol ?: $existing?->symbol,
                        'exchange' => $data['exchange'] ?? $existing?->exchange ?? 'NSE',
                        'ipo_type' => $data['ipo_type'] ?? $existing?->ipo_type ?? 'mainboard',
                        'category' => $data['category'] ?? $existing?->category,
                        'open_date' => $data['open_date'] ?: $existing?->open_date,
                        'close_date' => $data['close_date'] ?: $existing?->close_date,
                        'allotment_date' => $data['allotment_date'] ?: $existing?->allotment_date,
                        'listing_date' => $data['listing_date'] ?: $existing?->listing_date,
                        'price_band_min' => $data['price_band_min'] ?? $existing?->price_band_min,
                        'price_band_max' => $data['price_band_max'] ?? $existing?->price_band_max,
                        'issue_price' => $data['issue_price'] ?? $existing?->issue_price,
                        'lot_size' => $data['lot_size'] ?: ($existing?->lot_size ?? 1),
                        'min_retail_qty' => $data['min_retail_qty'] ?? $existing?->min_retail_qty,
                        'issue_size' => $data['issue_size'] ?? $existing?->issue_size,
                        'gmp' => $data['gmp'] ?? $existing?->gmp,
                        'status' => $data['status'] ?? ($existing?->status ?? 'upcoming'),
                        'provider' => $name,
                        'provider_id' => $providerId,
                        'raw_provider_data' => $data,
                        'last_synced_at' => now(),
                    ];

                    if ($existing) {
                        // Notice: We update market data fields only! Configured rates in `ipo_rates` remain untouched!
                        $existing->update($fieldsToUpdate);
                        $updatedCount++;
                    } else {
                        Ipo::create($fieldsToUpdate);
                        $createdCount++;
                    }
                }
            });
        } catch (Exception $e) {
            $status = 'failed';
            $errorMessage = $e->getMessage();
        }

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);

        return SyncLog::create([
            'provider' => $name,
            'status' => $status,
            'ipos_created' => $createdCount,
            'ipos_updated' => $updatedCount,
            'error_message' => $errorMessage,
            'execution_time_ms' => $durationMs,
            'triggered_by_user_id' => Auth::id(),
            'created_at' => now(),
        ]);
    }
}
