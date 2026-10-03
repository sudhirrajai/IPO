<?php

use App\Models\Ipo;
use App\Models\User;
use App\Services\GmpScraperService;
use Illuminate\Support\Facades\Http;

it('parses InvestorGain HTML sample and extracts IPOs correctly', function () {
    $service = new GmpScraperService();
    $sampleHtml = <<<HTML
<table>
    <tr><th>Name</th><th>GMP</th><th>Rating</th><th>Sub</th><th>Price</th><th>IPO Size</th><th>Lot</th><th>Open</th><th>Close</th><th>BoA</th><th>Listing</th><th>Updated</th></tr>
    <tr>
        <td><a href="#">TNA Solutions</a> <span class="badge">BSE SME</span></td>
        <td>₹10 (14.29%)6 ↓ / 10 ↑</td>
        <td>🔥</td>
        <td>1.71x</td>
        <td>70</td>
        <td>₹37.86 Cr</td>
        <td>2,000</td>
        <td>30-Sep</td>
        <td>6-Oct</td>
        <td>7-Oct</td>
        <td>9-Oct</td>
        <td>3-Oct 21:37</td>
    </tr>
    <tr>
        <td><a href="#">Vishal Nirmiti</a></td>
        <td>₹20 (9.09%)</td>
        <td>🔥</td>
        <td>0.6x</td>
        <td>220</td>
        <td>₹100 Cr</td>
        <td>500</td>
        <td>1-Oct</td>
        <td>5-Oct</td>
        <td>6-Oct</td>
        <td>8-Oct</td>
        <td>3-Oct 21:37</td>
    </tr>
    <tr>
        <td><a href="#">Unpriced IPO</a></td>
        <td>₹-- (0.00%)</td>
        <td></td>
        <td>-</td>
        <td>100</td>
        <td>₹50 Cr</td>
        <td>1,000</td>
        <td>1-Oct</td>
        <td>5-Oct</td>
        <td>6-Oct</td>
        <td>8-Oct</td>
        <td>3-Oct 21:37</td>
    </tr>
</table>
HTML;

    $items = $service->parseHtml($sampleHtml);

    expect($items)->toHaveCount(3);
    
    // SME
    expect($items[0]['name'])->toBe('TNA Solutions');
    expect($items[0]['ipo_type'])->toBe('sme');
    expect($items[0]['gmp'])->toBe(10.0);
    expect($items[0]['gmp_percent'])->toBe(14.29);
    expect($items[0]['subscription'])->toBe(1.71);
    expect($items[0]['price'])->toBe(70.0);
    expect($items[0]['lot'])->toBe(2000);

    // Mainboard
    expect($items[1]['name'])->toBe('Vishal Nirmiti');
    expect($items[1]['ipo_type'])->toBe('mainboard');
    expect($items[1]['gmp'])->toBe(20.0);
    expect($items[1]['subscription'])->toBe(0.6);

    // Unpriced
    expect($items[2]['name'])->toBe('Unpriced IPO');
    expect($items[2]['gmp'])->toBeNull();
});

it('syncs scraped GMP into database IPOs with fuzzy matching', function () {
    $ipo = Ipo::create([
        'company_name' => 'TNA Solutions Limited IPO',
        'symbol' => 'TNA',
        'exchange' => 'BSE',
        'ipo_type' => 'sme',
        'lot_size' => 2000,
        'status' => 'open',
        'provider' => 'test',
        'gmp' => 0,
    ]);

    Http::fake([
        GmpScraperService::INVESTORGAIN_URL => Http::response(<<<HTML
<table>
    <tr><th>Name</th><th>GMP</th><th>Rating</th><th>Sub</th><th>Price</th><th>IPO Size</th><th>Lot</th><th>Open</th><th>Close</th><th>BoA</th><th>Listing</th><th>Updated</th></tr>
    <tr>
        <td><a href="#">TNA Solutions</a> <span class="badge">BSE SME</span></td>
        <td>₹12.5 (17.86%)</td>
        <td>🔥</td>
        <td>2.5x</td>
        <td>70</td>
        <td>₹37.86 Cr</td>
        <td>2,000</td>
        <td>30-Sep</td>
        <td>6-Oct</td>
        <td>7-Oct</td>
        <td>9-Oct</td>
        <td>3-Oct 21:37</td>
    </tr>
</table>
HTML, 200),
    ]);

    $service = new GmpScraperService();
    $result = $service->syncGmpData();

    expect($result['success'])->toBeTrue();
    expect($result['matched_count'])->toBe(1);

    $ipo->refresh();
    expect((float)$ipo->gmp)->toBe(12.5);
    expect($ipo->total_subscription)->toBe('2.5');
    expect($ipo->raw_provider_data['gmp_source'])->toBe('investorgain');
    expect($ipo->raw_provider_data['gmp_percent'])->toBe(17.86);
});

it('can trigger gmp scrape through artisan command', function () {
    Http::fake([
        GmpScraperService::INVESTORGAIN_URL => Http::response(<<<HTML
<table>
    <tr><th>Name</th><th>GMP</th><th>Rating</th><th>Sub</th><th>Price</th><th>IPO Size</th><th>Lot</th><th>Open</th><th>Close</th><th>BoA</th><th>Listing</th><th>Updated</th></tr>
    <tr>
        <td><a href="#">Sample IPO</a></td>
        <td>₹15 (10.00%)</td>
        <td></td>
        <td>1.2x</td>
        <td>150</td>
        <td>₹10 Cr</td>
        <td>100</td>
        <td>1-Oct</td>
        <td>2-Oct</td>
        <td>3-Oct</td>
        <td>4-Oct</td>
        <td>3-Oct</td>
    </tr>
</table>
HTML, 200),
    ]);

    $this->artisan('ipo:scrape-gmp --dry-run')
        ->assertExitCode(0);
});

it('allows admin to trigger live GMP scrape via POST /sync/gmp', function () {
    $admin = User::factory()->create([
        'role' => 'admin',
    ]);

    Http::fake([
        GmpScraperService::INVESTORGAIN_URL => Http::response('<table><tr><th>Name</th></tr></table>', 200),
    ]);

    $response = $this->actingAs($admin)->post('/sync/gmp');

    $response->assertRedirect();
});
