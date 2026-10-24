<?php

namespace App\Console\Commands;

use App\Models\Ipo;
use Illuminate\Console\Command;

class DeduplicateIposCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ipo:deduplicate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Find and consolidate duplicate IPO records, preserving applications, rates, and favorites';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Scanning database for duplicate IPO records...');
        $deleted = Ipo::deduplicate();

        if ($deleted > 0) {
            $this->info("Successfully merged and removed {$deleted} duplicate IPO record(s).");
        } else {
            $this->info('No duplicate IPOs found in the database.');
        }

        return self::SUCCESS;
    }
}
