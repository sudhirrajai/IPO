<?php

namespace App\Jobs;

use App\Models\ApplicationBatch;
use App\Services\ApplicationBatchService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckBatchAllotmentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Timeout for job in seconds (enough for headless Chrome scraper if needed).
     */
    public int $timeout = 120;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public ApplicationBatch $batch,
        public string $provider = 'auto'
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Reload batch in case status changed
            $this->batch->refresh();

            Log::info("Starting background allotment check for batch {$this->batch->batch_number} (Provider: {$this->provider})");

            $result = ApplicationBatchService::executeCheckAllotment($this->batch, $this->provider);

            Log::info("Completed background allotment check for batch {$this->batch->batch_number}: " . json_encode($result));
        } catch (\Throwable $e) {
            Log::error("Failed background allotment check for batch {$this->batch->id}: " . $e->getMessage());

            // Clear checking status on failure
            $details = is_array($this->batch->allotment_details) ? $this->batch->allotment_details : [];
            $details['checking'] = false;
            $details['error'] = $e->getMessage();
            $this->batch->updateQuietly(['allotment_details' => $details]);
        }
    }
}
