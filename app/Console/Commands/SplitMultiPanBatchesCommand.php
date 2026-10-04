<?php

namespace App\Console\Commands;

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Services\ApplicationBatchService;
use App\Services\AuditService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SplitMultiPanBatchesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:split-multi-pan-batches {--batch-id= : Optional specific batch ID to split}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Split existing multi-PAN application batches into individual application entries per PAN';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $batchId = $this->option('batch-id');

        $query = ApplicationBatch::with(['batchPans.userPan', 'ipo'])
            ->where(function ($q) {
                $q->whereHas('batchPans', null, '>', 1)
                  ->orWhere('application_count', '>', 1);
            });

        if ($batchId) {
            $query->where('id', $batchId);
        }

        $batches = $query->get();

        if ($batches->isEmpty()) {
            $this->info('No multi-PAN application batches found.');
            return Command::SUCCESS;
        }

        $this->info("Found {$batches->count()} multi-PAN batch(es) to split.");

        $totalNewBatches = 0;

        foreach ($batches as $parentBatch) {
            $this->line("Processing batch {$parentBatch->batch_number} (ID: {$parentBatch->id}) with {$parentBatch->batchPans->count()} PAN(s)...");

            DB::transaction(function () use ($parentBatch, &$totalNewBatches) {
                $pans = $parentBatch->batchPans;
                $originalCount = max(1, $parentBatch->application_count ?: $pans->count());

                $perAppCapital = (float) ($parentBatch->capital_per_application > 0
                    ? $parentBatch->capital_per_application
                    : ($parentBatch->ipo_amount / $originalCount));

                $perAppUserPayout = round($parentBatch->expected_user_payout / $originalCount, 2);
                $perAppGrossProfit = round($parentBatch->expected_gross_profit / $originalCount, 2);
                $perAppNetEarnings = round($parentBatch->expected_net_earnings / $originalCount, 2);
                $perAppCapitalAmount = $parentBatch->funding_source === 'my_money' ? $perAppCapital : 0;

                if ($pans->isNotEmpty()) {
                    foreach ($pans as $batchPan) {
                        $userPan = $batchPan->userPan;
                        $applicantName = $userPan?->account_holder_name ?: $parentBatch->applicant_name;
                        $panNumber = $batchPan->pan_number_snapshot ?: $userPan?->pan_number;
                        $userId = $userPan?->user_id ?: $parentBatch->user_id;

                        $newBatchNumber = ApplicationBatchService::generateBatchNumber();

                        $newBatch = ApplicationBatch::create([
                            'batch_number' => $newBatchNumber,
                            'ipo_id' => $parentBatch->ipo_id,
                            'user_id' => $userId,
                            'applicant_name' => $applicantName,
                            'bank_name' => $parentBatch->bank_name,
                            'pan_number' => $panNumber,
                            'upi_id' => $parentBatch->upi_id,
                            'upi_app' => $parentBatch->upi_app,
                            'rate_id' => $parentBatch->rate_id,
                            'application_count' => 1,
                            'funding_source' => $parentBatch->funding_source,
                            'profit_sharing_type' => $parentBatch->profit_sharing_type,
                            'profit_sharing_value' => $parentBatch->profit_sharing_value,
                            'trader_rate_snapshot' => $parentBatch->trader_rate_snapshot,
                            'published_rate_snapshot' => $parentBatch->published_rate_snapshot,
                            'margin_snapshot' => $parentBatch->margin_snapshot,
                            'gmp_snapshot' => $parentBatch->gmp_snapshot,
                            'ipo_amount' => $perAppCapital,
                            'capital_per_application' => $perAppCapital,
                            'capital_amount' => $perAppCapitalAmount,
                            'expected_gross_profit' => $perAppGrossProfit,
                            'expected_user_payout' => $perAppUserPayout,
                            'expected_net_earnings' => $perAppNetEarnings,
                            'settled_gross_profit' => 0,
                            'settled_user_payout' => 0,
                            'settled_net_earnings' => 0,
                            'capital_returned' => 0,
                            'application_status' => $parentBatch->application_status,
                            'settlement_status' => $parentBatch->settlement_status,
                            'trader_reference' => $parentBatch->trader_reference,
                            'submission_date' => $parentBatch->submission_date,
                            'notes' => $parentBatch->notes ? ($parentBatch->notes . " (Split from {$parentBatch->batch_number})") : "Split from {$parentBatch->batch_number}",
                            'allotment_details' => $batchPan->allotment_details ?: $parentBatch->allotment_details,
                            'allotment_checked_at' => $parentBatch->allotment_checked_at,
                            'created_by_user_id' => $parentBatch->created_by_user_id,
                        ]);

                        ApplicationBatchPan::create([
                            'application_batch_id' => $newBatch->id,
                            'user_pan_id' => $batchPan->user_pan_id,
                            'sequence_number' => 1,
                            'pan_number_snapshot' => $panNumber,
                            'allotment_status' => $batchPan->allotment_status ?: 'pending',
                            'allotment_details' => $batchPan->allotment_details,
                        ]);

                        $totalNewBatches++;
                        $this->line("  -> Created {$newBatch->batch_number} for PAN {$panNumber} ({$applicantName})");
                    }
                } else {
                    // No batchPans attached, but count > 1
                    for ($i = 1; $i <= $originalCount; $i++) {
                        $newBatchNumber = ApplicationBatchService::generateBatchNumber();

                        $newBatch = ApplicationBatch::create([
                            'batch_number' => $newBatchNumber,
                            'ipo_id' => $parentBatch->ipo_id,
                            'user_id' => $parentBatch->user_id,
                            'applicant_name' => $parentBatch->applicant_name ? "{$parentBatch->applicant_name} (#{$i})" : "Applicant (#{$i})",
                            'bank_name' => $parentBatch->bank_name,
                            'pan_number' => $parentBatch->pan_number,
                            'upi_id' => $parentBatch->upi_id,
                            'upi_app' => $parentBatch->upi_app,
                            'rate_id' => $parentBatch->rate_id,
                            'application_count' => 1,
                            'funding_source' => $parentBatch->funding_source,
                            'profit_sharing_type' => $parentBatch->profit_sharing_type,
                            'profit_sharing_value' => $parentBatch->profit_sharing_value,
                            'trader_rate_snapshot' => $parentBatch->trader_rate_snapshot,
                            'published_rate_snapshot' => $parentBatch->published_rate_snapshot,
                            'margin_snapshot' => $parentBatch->margin_snapshot,
                            'gmp_snapshot' => $parentBatch->gmp_snapshot,
                            'ipo_amount' => $perAppCapital,
                            'capital_per_application' => $perAppCapital,
                            'capital_amount' => $perAppCapitalAmount,
                            'expected_gross_profit' => $perAppGrossProfit,
                            'expected_user_payout' => $perAppUserPayout,
                            'expected_net_earnings' => $perAppNetEarnings,
                            'application_status' => $parentBatch->application_status,
                            'settlement_status' => $parentBatch->settlement_status,
                            'trader_reference' => $parentBatch->trader_reference,
                            'submission_date' => $parentBatch->submission_date,
                            'notes' => $parentBatch->notes,
                            'created_by_user_id' => $parentBatch->created_by_user_id,
                        ]);

                        $totalNewBatches++;
                        $this->line("  -> Created {$newBatch->batch_number} (#{$i})");
                    }
                }

                // Delete old parent batch and its batch_pans
                $parentBatch->batchPans()->delete();
                $parentBatch->delete();
            });
        }

        $this->info("Done! Successfully split into {$totalNewBatches} individual application entries.");

        return Command::SUCCESS;
    }
}
