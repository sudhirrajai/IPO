<?php

namespace App\Services;

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\Ipo;
use App\Models\UserPan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ApplicationBatchService
{
    /**
     * Generate unique batch number.
     */
    public static function generateBatchNumber(): string
    {
        $prefix = 'BATCH-'.date('Ym').'-';
        $latest = ApplicationBatch::where('batch_number', 'like', "{$prefix}%")
            ->orderByDesc('id')
            ->first();

        $seq = 1;
        if ($latest && preg_match('/(\d+)$/', $latest->batch_number, $matches)) {
            $seq = ((int) $matches[1]) + 1;
        }

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Create an application batch with immutable snapshots.
     */
    public static function createBatch(array $data, bool $isAdmin = false): ApplicationBatch
    {
        $ipoId = (int) ($data['ipo_id'] ?? 0);
        $userId = (int) ($data['user_id'] ?? 0);
        $count = max(1, (int) ($data['application_count'] ?? 1));
        $fundingSource = ($data['funding_source'] ?? 'my_money') === 'user_money' ? 'user_money' : 'my_money';

        $ipo = Ipo::with('activeRate')->findOrFail($ipoId);
        $activeRate = $ipo->activeRate;

        $isDirect = ! empty($data['applicant_name'])
            || ! empty($data['bank_name'])
            || ! empty($data['pan_number'])
            || ! empty($data['upi_id'])
            || in_array($data['profit_sharing_type'] ?? '', ['fix', 'percentage']);

        $profitSharingType = $data['profit_sharing_type'] ?? ($isDirect ? 'fix' : 'rate_margin');
        $profitSharingValue = isset($data['profit_sharing_value']) ? (float) $data['profit_sharing_value'] : 0.0;

        $lotSize = (int) ($ipo->lot_size ?? 1);
        $issuePrice = (float) ($ipo->issue_price ?? $ipo->price_band_max ?? 0);
        $capitalPerApp = isset($data['capital_per_application']) && (float) $data['capital_per_application'] > 0
            ? (float) $data['capital_per_application']
            : (float) ($lotSize * $issuePrice);
        $totalCapital = round($capitalPerApp * $count, 2);
        $gmpSnapshot = (float) ($ipo->gmp ?? 0);
        $expectedListingGain = round($lotSize * $gmpSnapshot * $count, 2);

        if ($profitSharingType === 'fix') {
            if (! $isAdmin && ! ($ipo->accept_fix_applications ?? true)) {
                throw new InvalidArgumentException("Fixed rate applications are currently paused by the admin for {$ipo->company_name}. Please choose another profit sharing model.");
            }

            // Flat profit sharing payout decided
            $userPayout = round($profitSharingValue * $count, 2);
            $grossProfit = $expectedListingGain > 0 ? $expectedListingGain : round($userPayout, 2);
            $netEarnings = round($grossProfit - $userPayout, 2);
            $traderRate = 0.0;
            $publishedRate = 0.0;
            $margin = 0.0;
            $capitalAmount = $totalCapital;
        } elseif ($profitSharingType === 'percentage') {
            // Percentage of listing gain decided
            $userPayout = round(($profitSharingValue / 100) * $expectedListingGain, 2);
            $grossProfit = $expectedListingGain;
            $netEarnings = round($grossProfit - $userPayout, 2);
            $traderRate = 0.0;
            $publishedRate = 0.0;
            $margin = 0.0;
            $capitalAmount = $totalCapital;
        } else {
            // Traditional rate margin based
            if (! $activeRate && ! ($isAdmin && isset($data['override_trader_rate']) && isset($data['override_published_rate']))) {
                throw new InvalidArgumentException("IPO {$ipo->company_name} does not have an active rate configured yet. You can submit a direct application with Fixed or Percentage profit sharing.");
            }

            if ($isAdmin && isset($data['override_trader_rate']) && isset($data['override_published_rate'])) {
                $traderRate = (float) $data['override_trader_rate'];
                $publishedRate = (float) $data['override_published_rate'];
                $margin = FinancialCalculationService::calculateMargin($traderRate, $publishedRate);
            } else {
                $traderRate = (float) $activeRate->trader_rate;
                $publishedRate = (float) $activeRate->published_rate;
                $margin = (float) $activeRate->margin;
            }

            $estimates = FinancialCalculationService::computeBatchEstimates(
                $fundingSource,
                $count,
                $traderRate,
                $publishedRate,
                $capitalPerApp,
                isset($data['expected_gross_profit']) ? (float) $data['expected_gross_profit'] : null,
                isset($data['expected_user_payout']) ? (float) $data['expected_user_payout'] : null
            );

            $grossProfit = $estimates['expected_gross_profit'];
            $userPayout = $estimates['expected_user_payout'];
            $netEarnings = $estimates['expected_net_earnings'];
            $capitalAmount = $estimates['capital_amount'];
        }

        // Auto-save bank account if provided
        $savedBank = null;
        if (! empty($data['bank_name'])) {
            $savedBank = \App\Models\BankAccount::firstOrCreate([
                'user_id' => $userId,
                'bank_name' => trim($data['bank_name']),
            ], [
                'account_holder_name' => $data['applicant_name'] ?? null,
                'status' => 'active',
            ]);
        }

        // Auto-save / link UPI ID if provided
        $upiApp = null;
        if (! empty($data['upi_id'])) {
            $cleanUpi = strtolower(trim($data['upi_id']));
            $upiApp = ! empty($data['upi_app']) && $data['upi_app'] !== 'Auto'
                ? $data['upi_app']
                : \App\Models\UserUpi::detectApp($cleanUpi);

            \App\Models\UserUpi::updateOrCreate([
                'user_id' => $userId,
                'upi_id' => $cleanUpi,
            ], [
                'bank_account_id' => $savedBank?->id,
                'upi_app' => $upiApp,
                'status' => 'active',
            ]);
        }

        // Auto-save PAN if provided
        $panIds = $data['pan_ids'] ?? [];
        if (empty($panIds) && ! empty($data['pan_id'])) {
            $panIds = [$data['pan_id']];
        }
        if (! empty($data['pan_number'])) {
            $panNum = strtoupper(trim($data['pan_number']));
            $pan = UserPan::firstOrCreate([
                'user_id' => $userId,
                'pan_number' => $panNum,
            ], [
                'account_holder_name' => $data['applicant_name'] ?? 'Applicant',
                'status' => 'active',
            ]);
            if (! in_array($pan->id, $panIds)) {
                $panIds[] = $pan->id;
            }
        }

        return DB::transaction(function () use (
            $ipo,
            $userId,
            $activeRate,
            $count,
            $fundingSource,
            $profitSharingType,
            $profitSharingValue,
            $traderRate,
            $publishedRate,
            $margin,
            $capitalPerApp,
            $capitalAmount,
            $totalCapital,
            $gmpSnapshot,
            $grossProfit,
            $userPayout,
            $netEarnings,
            $panIds,
            $upiApp,
            $data
        ) {
            $batchNumber = self::generateBatchNumber();

            $batch = ApplicationBatch::create([
                'batch_number' => $batchNumber,
                'ipo_id' => $ipo->id,
                'user_id' => $userId,
                'applicant_name' => $data['applicant_name'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'pan_number' => ! empty($data['pan_number']) ? strtoupper(trim($data['pan_number'])) : null,
                'upi_id' => ! empty($data['upi_id']) ? strtolower(trim($data['upi_id'])) : null,
                'upi_app' => $upiApp,
                'rate_id' => $activeRate?->id,
                'application_count' => $count,
                'funding_source' => $fundingSource,
                'profit_sharing_type' => $profitSharingType,
                'profit_sharing_value' => $profitSharingValue,
                'trader_rate_snapshot' => $traderRate,
                'published_rate_snapshot' => $publishedRate,
                'margin_snapshot' => $margin,
                'gmp_snapshot' => $gmpSnapshot,
                'ipo_amount' => $totalCapital,
                'capital_per_application' => $capitalPerApp,
                'capital_amount' => $capitalAmount,
                'expected_gross_profit' => $grossProfit,
                'expected_user_payout' => $userPayout,
                'expected_net_earnings' => $netEarnings,
                'application_status' => $data['application_status'] ?? ((! ($ipo->auto_approve_fix ?? true) && ! Auth::user()?->isAdmin()) ? 'pending_approval' : 'confirmed'),
                'settlement_status' => 'estimated',
                'trader_reference' => $data['trader_reference'] ?? null,
                'submission_date' => $data['submission_date'] ?? now()->format('Y-m-d'),
                'notes' => $data['notes'] ?? null,
                'created_by_user_id' => Auth::id(),
            ]);

            // Map PAN records if provided
            if (! empty($panIds)) {
                $pans = UserPan::whereIn('id', $panIds)->get()->keyBy('id');
                $seq = 1;
                foreach ($panIds as $panId) {
                    if (isset($pans[$panId])) {
                        $pan = $pans[$panId];
                        ApplicationBatchPan::create([
                            'application_batch_id' => $batch->id,
                            'user_pan_id' => $pan->id,
                            'sequence_number' => $seq++,
                            'pan_number_snapshot' => $pan->pan_number,
                            'allotment_status' => 'pending',
                        ]);
                    }
                }
            }

            AuditService::log('batch_created', $batch, null, [
                'batch_number' => $batchNumber,
                'count' => $count,
                'applicant_name' => $data['applicant_name'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'profit_sharing_type' => $profitSharingType,
                'profit_sharing_value' => $profitSharingValue,
            ], "Created application batch {$batchNumber} for {$ipo->company_name}");

            return $batch;
        });
    }

    /**
     * Update application batch status.
     */
    public static function updateStatus(ApplicationBatch $batch, string $newStatus, ?string $note = null): ApplicationBatch
    {
        $oldStatus = $batch->application_status;

        $updates = [
            'application_status' => $newStatus,
            'notes' => $note ? ($batch->notes ? "{$batch->notes}\n{$note}" : $note) : $batch->notes,
        ];

        // 1-Click Allotment Actions & Settlement
        if ($newStatus === 'allotted') {
            $updates['settled_gross_profit'] = $batch->expected_gross_profit;
            $updates['settled_user_payout'] = $batch->expected_user_payout;
            $updates['settled_net_earnings'] = $batch->expected_net_earnings;
            $updates['capital_returned'] = $batch->capital_amount;
            $updates['settlement_status'] = 'settled';

            // Also update batch pans
            $batch->batchPans()->update(['allotment_status' => 'allotted']);
        } elseif ($newStatus === 'not_allotted') {
            $updates['settled_gross_profit'] = 0;
            $updates['settled_user_payout'] = 0;
            $updates['settled_net_earnings'] = 0;
            $updates['capital_returned'] = $batch->capital_amount;
            $updates['settlement_status'] = 'settled';

            // Also update batch pans
            $batch->batchPans()->update(['allotment_status' => 'not_allotted']);
        }

        $batch->update($updates);

        AuditService::log('batch_status_changed', $batch, ['status' => $oldStatus], ['status' => $newStatus], "Changed batch {$batch->batch_number} status from {$oldStatus} to {$newStatus}");

        return $batch;
    }

    /**
     * Update an application batch (Admin only).
     * Allows editing PAN, rates (Fixed, Percentage, or Rate Margin), and recalculates financials.
     */
    public static function updateBatch(ApplicationBatch $batch, array $data, bool $isAdmin = true): ApplicationBatch
    {
        if (! $isAdmin) {
            throw new InvalidArgumentException('Only administrators can edit application rates and PANs.');
        }

        $ipo = $batch->ipo ?: Ipo::findOrFail($batch->ipo_id);
        $count = max(1, (int) ($data['application_count'] ?? $batch->application_count ?? 1));
        $fundingSource = ($data['funding_source'] ?? $batch->funding_source) === 'user_money' ? 'user_money' : 'my_money';

        $profitSharingType = $data['profit_sharing_type'] ?? $batch->profit_sharing_type ?? 'fix';
        $profitSharingValue = isset($data['profit_sharing_value']) ? (float) $data['profit_sharing_value'] : (float) ($batch->profit_sharing_value ?? 0.0);

        $lotSize = (int) ($ipo->lot_size ?? 1);
        $issuePrice = (float) ($ipo->issue_price ?? $ipo->price_band_max ?? 0);
        $capitalPerApp = isset($data['capital_per_application']) && (float) $data['capital_per_application'] > 0
            ? (float) $data['capital_per_application']
            : ($batch->capital_amount && $batch->application_count ? (float) ($batch->capital_amount / $batch->application_count) : (float) ($lotSize * $issuePrice));

        $totalCapital = round($capitalPerApp * $count, 2);
        $gmpSnapshot = (float) ($batch->gmp_snapshot ?: ($ipo->gmp ?? 0));
        $expectedListingGain = round($lotSize * $gmpSnapshot * $count, 2);

        $traderRate = 0.0;
        $publishedRate = 0.0;
        $margin = 0.0;

        if ($profitSharingType === 'fix') {
            $userPayout = round($profitSharingValue * $count, 2);
            $grossProfit = $expectedListingGain > 0 ? $expectedListingGain : round($userPayout, 2);
            $netEarnings = round($grossProfit - $userPayout, 2);
            $capitalAmount = $totalCapital;
        } elseif ($profitSharingType === 'percentage') {
            $userPayout = round(($profitSharingValue / 100) * $expectedListingGain, 2);
            $grossProfit = $expectedListingGain;
            $netEarnings = round($grossProfit - $userPayout, 2);
            $capitalAmount = $totalCapital;
        } else {
            $traderRate = isset($data['override_trader_rate']) ? (float) $data['override_trader_rate'] : (float) ($batch->trader_rate_snapshot ?? 0);
            $publishedRate = isset($data['override_published_rate']) ? (float) $data['override_published_rate'] : (float) ($batch->published_rate_snapshot ?? 0);
            $margin = FinancialCalculationService::calculateMargin($traderRate, $publishedRate);

            $estimates = FinancialCalculationService::computeBatchEstimates(
                $fundingSource,
                $count,
                $traderRate,
                $publishedRate,
                $capitalPerApp
            );

            $grossProfit = $estimates['expected_gross_profit'];
            $userPayout = $estimates['expected_user_payout'];
            $netEarnings = $estimates['expected_net_earnings'];
            $capitalAmount = $estimates['capital_amount'];
        }

        // Handle PAN updates
        $panNum = null;
        $userPanId = null;
        if (! empty($data['pan_id'])) {
            $savedPan = UserPan::find($data['pan_id']);
            if ($savedPan) {
                $panNum = strtoupper($savedPan->pan_number);
                $userPanId = $savedPan->id;
                if (empty($data['applicant_name']) && ! empty($savedPan->account_holder_name)) {
                    $data['applicant_name'] = $savedPan->account_holder_name;
                }
            }
        } elseif (! empty($data['pan_number'])) {
            $panNum = strtoupper(trim($data['pan_number']));
            $createdPan = UserPan::firstOrCreate([
                'user_id' => $batch->user_id,
                'pan_number' => $panNum,
            ], [
                'account_holder_name' => $data['applicant_name'] ?? $batch->applicant_name ?? 'Applicant',
                'status' => 'active',
            ]);
            $userPanId = $createdPan->id;
        }

        $updateFields = [
            'application_count' => $count,
            'funding_source' => $fundingSource,
            'profit_sharing_type' => $profitSharingType,
            'profit_sharing_value' => $profitSharingValue,
            'capital_amount' => $capitalAmount,
            'expected_gross_profit' => $grossProfit,
            'expected_user_payout' => $userPayout,
            'expected_net_earnings' => $netEarnings,
            'trader_rate_snapshot' => $traderRate,
            'published_rate_snapshot' => $publishedRate,
            'margin_snapshot' => $margin,
        ];

        // If batch was already marked allotted, keep settled values in sync with new rates
        if ($batch->application_status === 'allotted') {
            $updateFields['settled_gross_profit'] = $grossProfit;
            $updateFields['settled_user_payout'] = $userPayout;
            $updateFields['settled_net_earnings'] = $netEarnings;
            $updateFields['capital_returned'] = $capitalAmount;
        }

        if (! empty($data['applicant_name'])) {
            $updateFields['applicant_name'] = $data['applicant_name'];
        }
        if (! empty($data['bank_name'])) {
            $updateFields['bank_name'] = $data['bank_name'];
        }
        if (isset($data['upi_id'])) {
            $updateFields['upi_id'] = $data['upi_id'];
        }
        if (isset($data['upi_app'])) {
            $updateFields['upi_app'] = $data['upi_app'];
        }
        if (isset($data['notes'])) {
            $updateFields['notes'] = $data['notes'];
        }
        if ($panNum) {
            $updateFields['pan_number'] = $panNum;
        }

        $batch->update($updateFields);

        if ($panNum) {
            $batchPan = $batch->batchPans()->first();
            if ($batchPan) {
                $batchPan->update([
                    'pan_number_snapshot' => $panNum,
                    'user_pan_id' => $userPanId ?? $batchPan->user_pan_id,
                ]);
            } else {
                $batch->batchPans()->create([
                    'user_pan_id' => $userPanId,
                    'pan_number_snapshot' => $panNum,
                    'shares_allotted' => 0,
                    'is_allotted' => false,
                ]);
            }
        }

        return $batch->fresh(['user', 'rate', 'batchPans.userPan', 'settlement']);
    }
}
