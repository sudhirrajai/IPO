<?php

namespace App\Console\Commands;

use App\Services\GmpScraperService;
use Illuminate\Console\Command;

class ScrapeGmpCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ipo:scrape-gmp {--dry-run : Only show matches without updating the database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Scrape live Grey Market Premium (GMP) data from InvestorGain and sync with local IPOs';

    /**
     * Execute the console command.
     */
    public function handle(GmpScraperService $scraperService): int
    {
        $this->info('Starting InvestorGain live GMP scraper...');

        if ($this->option('dry-run')) {
            $this->warn('Running in dry-run mode. Database will not be updated.');
            $items = $scraperService->scrapeInvestorGain();
            $this->info("Scraped " . count($items) . " records from InvestorGain.");
            
            $tableData = [];
            foreach (array_slice($items, 0, 15) as $item) {
                $tableData[] = [
                    $item['name'],
                    $item['ipo_type'],
                    $item['gmp'] !== null ? "₹{$item['gmp']}" : 'N/A',
                    $item['gmp_percent'] !== null ? "{$item['gmp_percent']}%" : '—',
                    $item['subscription'] ? "{$item['subscription']}x" : '—',
                    $item['updated_on'] ?? '—',
                ];
            }
            $this->table(['Name', 'Type', 'GMP', 'Gain %', 'Sub', 'Updated'], $tableData);
            return self::SUCCESS;
        }

        $result = $scraperService->syncGmpData();

        if (! $result['success']) {
            $this->error($result['message']);
            return self::FAILURE;
        }

        $this->info($result['message']);
        $this->info("Total Scraped: {$result['total_scraped']} | Matched: {$result['matched_count']} | Updated: {$result['updated_count']} in {$result['duration_ms']}ms");

        if (! empty($result['matches'])) {
            $tableRows = [];
            foreach ($result['matches'] as $m) {
                $tableRows[] = [
                    $m['ipo_id'],
                    $m['company_name'],
                    $m['matched_with'],
                    $m['gmp'] !== null ? "₹{$m['gmp']}" : 'N/A',
                    $m['subscription'] ? "{$m['subscription']}x" : '—',
                    $m['changed'] ? 'Updated' : 'Unchanged',
                ];
            }
            $this->table(['ID', 'Local IPO Name', 'InvestorGain Match', 'GMP', 'Sub', 'Status'], $tableRows);
        }

        return self::SUCCESS;
    }
}
