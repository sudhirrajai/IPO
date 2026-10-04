<?php

namespace App\Console\Commands;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Services\KfintechAllotmentService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class CheckIpoAllotmentCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ipo:check-allotment {--ipo_id= : Check allotment for specific IPO ID} {--force : Force check even if allotment date is in the future}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check and scrape IPO allotment status for applicants from KFintech';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting KFintech IPO allotment check...');

        $query = Ipo::query();

        if ($this->option('ipo_id')) {
            $query->where('id', $this->option('ipo_id'));
        } elseif (! $this->option('force')) {
            // Check IPOs whose allotment date has arrived or passed (or today)
            $today = Carbon::today()->toDateString();
            $query->where(function ($q) use ($today) {
                $q->whereNotNull('allotment_date')
                    ->where('allotment_date', '<=', $today)
                    ->whereNotIn('status', ['cancelled']);
            })->orWhere(function ($q) {
                // Or IPOs that have pending applications without allotment result
                $q->whereHas('applicationBatches', function ($b) {
                    $b->whereIn('application_status', ['submitted', 'confirmed', 'pending_allotment', 'ready']);
                });
            });
        }

        $ipos = $query->get();

        if ($ipos->isEmpty()) {
            $this->info('No eligible IPOs found for allotment check.');
            return self::SUCCESS;
        }

        $totalChecked = 0;
        $totalAllotted = 0;
        $totalNotAllotted = 0;

        foreach ($ipos as $ipo) {
            $this->line("Processing IPO: {$ipo->company_name} (ID: {$ipo->id})");

            $kfinMatch = KfintechAllotmentService::findMatchingKfinIpo($ipo);
            if (! $kfinMatch) {
                $this->warn("  -> Not found in KFintech active registry. Skipping.");
                continue;
            }

            $this->info("  -> Matched with KFintech: {$kfinMatch['name']} (Client ID: {$kfinMatch['clientId']})");

            // Find pending batches for this IPO
            $batches = ApplicationBatch::where('ipo_id', $ipo->id)
                ->whereIn('application_status', ['ready', 'submitted', 'confirmed', 'pending_allotment'])
                ->get();

            if ($batches->isEmpty()) {
                $this->line("  -> No pending applications found.");
                continue;
            }

            foreach ($batches as $batch) {
                $pan = $batch->pan_number;
                if (empty($pan)) {
                    $pan = $batch->batchPans()->with('userPan')->first()?->userPan?->pan_number;
                }

                if (empty($pan)) {
                    $this->warn("  -> Batch {$batch->batch_number} has no PAN linked. Skipping.");
                    continue;
                }

                $this->line("  -> Checking Batch {$batch->batch_number} for PAN: {$pan}...");
                $res = KfintechAllotmentService::checkBatchAllotment($batch);

                if ($res['success'] && $res['found']) {
                    $totalChecked++;
                    if ($res['allotted']) {
                        $totalAllotted++;
                        $this->info("     ✓ ALLOTTED! ({$res['all_shares']} / {$res['app_shares']} shares) Name: {$res['name_from_pan']}");
                    } else {
                        $totalNotAllotted++;
                        $this->comment("     ✗ Not Allotted. Name: {$res['name_from_pan']}");
                    }
                } else {
                    $this->line("     - Result: " . ($res['message'] ?? 'No record found'));
                }

                // Respectful rate limiting between requests
                usleep(500000); // 0.5s
            }
        }

        $this->info("Allotment check completed! Checked: {$totalChecked}, Allotted: {$totalAllotted}, Not Allotted: {$totalNotAllotted}");

        return self::SUCCESS;
    }
}
