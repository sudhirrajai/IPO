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
    protected $signature = 'ipo:check-allotment {--ipo_id= : Check allotment for specific IPO ID} {--batch_id= : Check allotment for a specific batch ID} {--provider=auto : Provider to use (auto, nse, bse, kfintech)} {--force : Force check even if allotment date is in the future}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check and scrape IPO allotment status for applicants across exchanges and registrars';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting multi-provider IPO allotment check...');

        if ($batchId = $this->option('batch_id')) {
            $batch = ApplicationBatch::find($batchId);
            if (! $batch) {
                $this->error("Batch #{$batchId} not found.");
                return self::FAILURE;
            }

            $provider = (string) $this->option('provider');
            $this->info("Checking single batch {$batch->batch_number} (Provider: {$provider})...");
            $res = \App\Services\ApplicationBatchService::executeCheckAllotment($batch, $provider);
            $this->line(json_encode($res, JSON_PRETTY_PRINT));
            return self::SUCCESS;
        }

        $query = Ipo::query();

        if ($this->option('ipo_id')) {
            $query->where('id', $this->option('ipo_id'));
        } elseif (! $this->option('force')) {
            $today = Carbon::today()->toDateString();
            $query->where(function ($q) use ($today) {
                $q->whereNotNull('allotment_date')
                    ->where('allotment_date', '<=', $today)
                    ->whereNotIn('status', ['cancelled']);
            })->orWhere(function ($q) {
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
        $provider = (string) $this->option('provider');

        foreach ($ipos as $ipo) {
            $this->line("Processing IPO: {$ipo->company_name} (ID: {$ipo->id})");

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
                $res = \App\Services\ApplicationBatchService::executeCheckAllotment($batch, $provider);

                if ($res['success'] && ($res['found'] ?? false)) {
                    $totalChecked++;
                    if ($res['allotted'] ?? false) {
                        $totalAllotted++;
                        $this->info("     ✓ ALLOTTED! ({$res['all_shares']} / {$res['app_shares']} shares) Source: " . ($res['provider'] ?? 'Exchange'));
                    } else {
                        $totalNotAllotted++;
                        $this->comment("     ✗ Not Allotted. Source: " . ($res['provider'] ?? 'Exchange'));
                    }
                } else {
                    $this->line("     - Result: " . ($res['message'] ?? 'No record found'));
                }

                usleep(500000); // 0.5s
            }
        }

        $this->info("Allotment check completed! Checked: {$totalChecked}, Allotted: {$totalAllotted}, Not Allotted: {$totalNotAllotted}");

        return self::SUCCESS;
    }
}
