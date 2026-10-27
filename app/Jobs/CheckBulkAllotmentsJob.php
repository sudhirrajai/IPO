<?php

namespace App\Jobs;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Services\ApplicationBatchService;
use App\Services\AuditService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckBulkAllotmentsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Timeout for bulk job (up to 15 minutes).
     */
    public int $timeout = 900;

    /**
     * Create a new job instance.
     *
     * @param array<int> $batchIds
     */
    public function __construct(
        public array $batchIds = [],
        public ?int $ipoId = null,
        public string $provider = 'auto',
        public ?int $userId = null
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $query = ApplicationBatch::query();

        if (! empty($this->batchIds)) {
            $query->whereIn('id', $this->batchIds);
        } elseif ($this->ipoId) {
            $query->where('ipo_id', $this->ipoId)
                ->whereNotIn('application_status', ['cancelled']);
        } else {
            // Check all unallotted batches for active/closed IPOs
            $query->whereNotIn('application_status', ['cancelled']);
        }

        $batches = $query->get();

        if ($batches->isEmpty()) {
            Log::info('CheckBulkAllotmentsJob: No batches found to process.');
            return;
        }

        Log::info("Starting CheckBulkAllotmentsJob for {$batches->count()} batch(es) (Provider: {$this->provider})");

        // First, mark all as checking so UI shows progress immediately
        foreach ($batches as $batch) {
            ApplicationBatchService::markChecking($batch);
        }

        $allottedCount = 0;
        $notAllottedCount = 0;
        $processedCount = 0;

        foreach ($batches as $batch) {
            try {
                $batch->refresh();
                $res = ApplicationBatchService::executeCheckAllotment($batch, $this->provider);
                $processedCount++;

                if ($res['success'] && ($res['found'] ?? false)) {
                    if ($res['allotted'] ?? false) {
                        $allottedCount++;
                    } else {
                        $notAllottedCount++;
                    }
                }

                // Short sleep between requests to be gentle on servers and rate limits
                usleep(500000); // 0.5s
            } catch (\Throwable $e) {
                Log::error("Bulk allotment check failed on batch {$batch->id}: " . $e->getMessage());
                $details = is_array($batch->allotment_details) ? $batch->allotment_details : [];
                $details['checking'] = false;
                $details['error'] = $e->getMessage();
                $batch->updateQuietly(['allotment_details' => $details]);
            }
        }

        if ($this->ipoId) {
            $ipo = Ipo::find($this->ipoId);
            $ipo?->updateQuietly(['allotment_scraped_at' => now()]);
        }

        AuditService::log('bulk_allotment_check', null, null, [
            'total_processed' => $processedCount,
            'allotted_count' => $allottedCount,
            'not_allotted_count' => $notAllottedCount,
            'provider' => $this->provider,
            'ipo_id' => $this->ipoId,
        ], "Completed bulk allotment check for {$processedCount} applications ({$allottedCount} allotted, {$notAllottedCount} not allotted).");

        Log::info("CheckBulkAllotmentsJob completed: {$processedCount} processed, {$allottedCount} allotted, {$notAllottedCount} not allotted.");
    }
}
