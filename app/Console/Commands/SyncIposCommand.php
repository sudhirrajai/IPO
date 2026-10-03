<?php

namespace App\Console\Commands;

use App\Services\IpoSyncService;
use Illuminate\Console\Command;

class SyncIposCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ipo:sync {provider? : Provider name (mock, ipoalerts, upstox)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize IPO data from configured external provider';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $providerName = $this->argument('provider');
        $this->info('Starting IPO synchronization'.($providerName ? " using [{$providerName}]" : '').'...');

        $log = IpoSyncService::sync($providerName);

        if ($log->status === 'success') {
            $this->info("Sync completed successfully in {$log->execution_time_ms}ms.");
            $this->line("Created: {$log->ipos_created}, Updated: {$log->ipos_updated}");

            return Command::SUCCESS;
        }

        $this->error("Sync failed: {$log->error_message}");

        return Command::FAILURE;
    }
}
