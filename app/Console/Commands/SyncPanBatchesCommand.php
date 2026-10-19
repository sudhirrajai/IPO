<?php

namespace App\Console\Commands;

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\UserPan;
use Illuminate\Console\Command;

class SyncPanBatchesCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'pans:sync-batches';

    /**
     * The console command description.
     */
    protected $description = 'Synchronize ApplicationBatch records with UserPan account holder names and PAN numbers';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting PAN to Application Batch synchronization...');

        $updatedBatchesCount = 0;
        $updatedBatchPansCount = 0;

        // 1. Sync from UserPans to ApplicationBatches
        $pans = UserPan::withTrashed()->get();
        foreach ($pans as $pan) {
            $holderName = $pan->account_holder_name;
            $panNumber = $pan->pan_number;

            if (empty($panNumber)) {
                continue;
            }

            // Batches linked via ApplicationBatchPan
            $linkedBatchIds = ApplicationBatchPan::where('user_pan_id', $pan->id)->pluck('application_batch_id');

            $batches = ApplicationBatch::whereIn('id', $linkedBatchIds)
                ->orWhere('pan_number', $panNumber)
                ->get();

            foreach ($batches as $batch) {
                $batchUpdates = [];

                if (! empty($holderName) && $batch->applicant_name !== $holderName) {
                    $batchUpdates['applicant_name'] = $holderName;
                }

                if ($batch->pan_number !== $panNumber) {
                    $batchUpdates['pan_number'] = $panNumber;
                }

                if (! empty($batchUpdates)) {
                    $batch->update($batchUpdates);
                    $updatedBatchesCount++;
                }

                // Ensure ApplicationBatchPan is in sync
                $batchPan = $batch->batchPans()->where('user_pan_id', $pan->id)->first();
                if ($batchPan) {
                    if ($batchPan->pan_number_snapshot !== $panNumber) {
                        $batchPan->update(['pan_number_snapshot' => $panNumber]);
                        $updatedBatchPansCount++;
                    }
                } else {
                    $firstPan = $batch->batchPans()->first();
                    if ($firstPan && empty($firstPan->user_pan_id)) {
                        $firstPan->update([
                            'user_pan_id' => $pan->id,
                            'pan_number_snapshot' => $panNumber,
                        ]);
                        $updatedBatchPansCount++;
                    } elseif (! $firstPan) {
                        $batch->batchPans()->create([
                            'user_pan_id' => $pan->id,
                            'sequence_number' => 1,
                            'pan_number_snapshot' => $panNumber,
                            'allotment_status' => 'pending',
                            'allotted_shares' => 0,
                        ]);
                        $updatedBatchPansCount++;
                    }
                }
            }
        }

        // 2. Batches with PAN numbers that match a UserPan
        $batchesWithPan = ApplicationBatch::whereNotNull('pan_number')->where('pan_number', '!=', '')->get();
        foreach ($batchesWithPan as $batch) {
            $panNum = strtoupper(trim($batch->pan_number));
            $matchedPan = UserPan::where('pan_number', $panNum)->first();
            if ($matchedPan) {
                if (! empty($matchedPan->account_holder_name) && $batch->applicant_name !== $matchedPan->account_holder_name) {
                    $batch->update(['applicant_name' => $matchedPan->account_holder_name]);
                    $updatedBatchesCount++;
                }

                if (! $batch->batchPans()->where('user_pan_id', $matchedPan->id)->exists()) {
                    $firstPan = $batch->batchPans()->first();
                    if ($firstPan) {
                        $firstPan->update([
                            'user_pan_id' => $matchedPan->id,
                            'pan_number_snapshot' => $panNum,
                        ]);
                    } else {
                        $batch->batchPans()->create([
                            'user_pan_id' => $matchedPan->id,
                            'sequence_number' => 1,
                            'pan_number_snapshot' => $panNum,
                            'allotment_status' => 'pending',
                            'allotted_shares' => 0,
                        ]);
                    }
                    $updatedBatchPansCount++;
                }
            }
        }

        $this->info("Synchronization complete. Updated {$updatedBatchesCount} batches and {$updatedBatchPansCount} batch PAN links.");

        return Command::SUCCESS;
    }
}
