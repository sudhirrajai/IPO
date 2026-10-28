<?php

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\User;
use App\Services\CsvExportService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('admin can set listing price and base price, and allotted batches calculate user collection, admin margin and trader payable', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user', 'name' => 'Krutarth Bhatt']);

    // Jio IPO: 12 shares per lot, base price ~13448 per lot
    $ipo = Ipo::create([
        'company_name' => 'Reliance Jio IPO',
        'symbol' => 'JIOPLATFOR',
        'exchange' => 'NSE',
        'lot_size' => 12,
        'status' => 'allotment_out',
    ]);

    // Allotted Batch: 1 lot, Trader rate = 2000, User rate = 1500
    $batch = ApplicationBatch::create([
        'user_id' => $user->id,
        'ipo_id' => $ipo->id,
        'batch_number' => 'BATCH-TEST-LISTED',
        'pan_number' => 'ABCDE1234F',
        'applicant_name' => 'Krutarth Bhatt',
        'application_count' => 1,
        'profit_sharing_type' => 'rate_margin',
        'published_rate_snapshot' => 1500.0,
        'trader_rate_snapshot' => 2000.0,
        'profit_sharing_value' => 1500.0,
        'margin_snapshot' => 500.0,
        'expected_user_payout' => 1500.0,
        'expected_net_earnings' => 500.0,
        'funding_source' => 'user_money',
        'application_status' => 'allotted',
        'settlement_status' => 'settled',
    ]);

    // Admin sets listing price: ₹1,358 per share, Base price per lot: ₹13,296 (12 * 1108), Profit per lot: ₹3,000
    $response = $this->actingAs($admin)->post("/ipos/{$ipo->id}/listing", [
        'listing_price' => 1358.0,
        'base_price_per_lot' => 13296.0,
        'listing_profit_per_lot' => 3000.0,
        'status' => 'listed',
    ]);

    $response->assertSessionHasNoErrors();
    $response->assertSessionHas('success');

    $ipo->refresh();
    expect($ipo->status)->toBe('listed')
        ->and((float) $ipo->listing_price)->toBe(1358.0)
        ->and((float) $ipo->calculated_listing_profit_per_lot)->toBe(3000.0);

    $batch->refresh();

    // Verify exact math:
    // Total profit = 3000
    // User Rate = 1500
    // Collect from User = 3000 - 1500 = 1500
    // Admin Margin = 2000 - 1500 = 500
    // Pay to Trader = 3000 - 2000 = 1000
    expect((float) $batch->listing_profit)->toBe(3000.0)
        ->and((float) $batch->settled_user_payout)->toBe(1500.0)
        ->and((float) $batch->user_collectible_amount)->toBe(1500.0)
        ->and((float) $batch->settled_net_earnings)->toBe(500.0)
        ->and((float) $batch->trader_payable_amount)->toBe(1000.0);

    // Verify CSV export includes listing columns and correct values
    $csvResponse = $this->actingAs($admin)->get(route('ipos.export.user-csv', $ipo));
    $csvResponse->assertOk();
    $csvContent = $csvResponse->streamedContent();

    expect($csvContent)->toContain('"Collect from User"')
        ->and($csvContent)->toContain('"Pay to Trader"')
        ->and($csvContent)->toContain('"Admin Margin"')
        ->and($csvContent)->toContain('3000,1500,1500,2000,500,1000');
});
