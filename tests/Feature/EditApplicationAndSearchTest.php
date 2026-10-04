<?php

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\Ipo;
use App\Models\IpoRate;
use App\Models\User;
use App\Models\UserPan;

test('admin can update application pan, rates, lots, bank details and notes', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']);

    $ipo = Ipo::create([
        'company_name' => 'Tech Corp Ltd',
        'symbol' => 'TECHCORP',
        'exchange' => 'NSE',
        'lot_size' => 50,
        'issue_price' => 200,
        'price_band_max' => 200,
        'status' => 'bidding_open',
    ]);

    $oldPan = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'ABCDE1234F',
        'account_holder_name' => 'Initial Applicant',
        'status' => 'active',
    ]);

    $newPan = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'XYZKL9876M',
        'account_holder_name' => 'Updated Applicant',
        'status' => 'active',
    ]);

    $batch = ApplicationBatch::create([
        'user_id' => $user->id,
        'ipo_id' => $ipo->id,
        'batch_number' => 'APP-2026-0001',
        'pan_number' => 'ABCDE1234F',
        'applicant_name' => 'Initial Applicant',
        'application_count' => 1,
        'profit_sharing_type' => 'fix',
        'profit_sharing_value' => 500,
        'expected_user_payout' => 500,
        'expected_net_earnings' => 0,
        'capital_amount' => 10000,
        'funding_source' => 'user_money',
        'application_status' => 'approved',
        'settlement_status' => 'pending',
    ]);

    // Admin edits: switches to new PAN, changes to rate_margin with trader rate 1500 and user rate 1200
    $response = $this->actingAs($admin)->put("/applications/{$batch->id}", [
        'pan_id' => $newPan->id,
        'profit_sharing_type' => 'rate_margin',
        'trader_rate' => 1500,
        'user_rate' => 1200,
        'lots' => 2,
        'bank_name' => 'Kotak Mahindra Bank',
        'upi_id' => 'updated@okaxis',
        'notes' => 'Updated by admin via edit modal',
    ]);

    $response->assertRedirect();
    $batch->refresh();

    expect($batch->pan_number)->toBe('XYZKL9876M')
        ->and($batch->applicant_name)->toBe('Updated Applicant')
        ->and($batch->application_count)->toBe(2)
        ->and($batch->profit_sharing_type)->toBe('rate_margin')
        ->and((float) $batch->trader_rate_snapshot)->toBe(1500.0)
        ->and((float) $batch->published_rate_snapshot)->toBe(1200.0)
        ->and((float) $batch->margin_snapshot)->toBe(300.0)
        ->and((float) $batch->expected_user_payout)->toBe(2400.0) // 1200 * 2 lots
        ->and((float) $batch->expected_net_earnings)->toBe(600.0)   // 300 * 2 lots
        ->and($batch->bank_name)->toBe('Kotak Mahindra Bank')
        ->and($batch->upi_id)->toBe('updated@okaxis')
        ->and($batch->notes)->toBe('Updated by admin via edit modal');
});

test('non-admin user is forbidden from updating applications', function () {
    $user = User::factory()->create(['role' => 'user']);
    $otherUser = User::factory()->create(['role' => 'user']);

    $ipo = Ipo::create([
        'company_name' => 'Secure Soft Ltd',
        'symbol' => 'SECSOFT',
        'exchange' => 'NSE',
        'lot_size' => 100,
        'issue_price' => 100,
        'price_band_max' => 100,
        'status' => 'bidding_open',
    ]);

    $batch = ApplicationBatch::create([
        'user_id' => $user->id,
        'ipo_id' => $ipo->id,
        'batch_number' => 'APP-2026-0002',
        'pan_number' => 'ABCDE1234F',
        'applicant_name' => 'Regular User',
        'application_count' => 1,
        'profit_sharing_type' => 'fix',
        'fix_profit_per_lot' => 500,
        'expected_user_earnings' => 500,
        'expected_net_earnings' => 0,
        'total_capital' => 10000,
        'funding_source' => 'user_money',
        'application_status' => 'approved',
        'settlement_status' => 'pending',
    ]);

    // Regular user attempting update must be 403 Forbidden
    $response = $this->actingAs($user)->put("/applications/{$batch->id}", [
        'profit_sharing_type' => 'fix',
        'fix_profit_per_lot' => 9999,
    ]);

    $response->assertForbidden();
});

test('search feature in applications filters by PAN, applicant, batch number, bank and user name', function () {
    $admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin Manager']);
    $userA = User::factory()->create(['role' => 'user', 'name' => 'Aarav Patel']);
    $userB = User::factory()->create(['role' => 'user', 'name' => 'Bhavna Joshi']);

    $ipo = Ipo::create([
        'company_name' => 'Searchable IPO Ltd',
        'symbol' => 'SEARCHIPO',
        'exchange' => 'NSE',
        'lot_size' => 10,
        'issue_price' => 50,
        'price_band_max' => 50,
        'status' => 'bidding_open',
    ]);

    $batchA = ApplicationBatch::create([
        'user_id' => $userA->id,
        'ipo_id' => $ipo->id,
        'batch_number' => 'BATCH-ALPHA-01',
        'pan_number' => 'AAAPA1111A',
        'applicant_name' => 'Aarav Patel',
        'bank_name' => 'State Bank of India',
        'upi_id' => 'aarav@oksbi',
        'application_count' => 1,
        'profit_sharing_type' => 'fix',
        'funding_source' => 'user_money',
        'application_status' => 'approved',
        'settlement_status' => 'pending',
    ]);

    $batchB = ApplicationBatch::create([
        'user_id' => $userB->id,
        'ipo_id' => $ipo->id,
        'batch_number' => 'BATCH-BETA-02',
        'pan_number' => 'BBBPB2222B',
        'applicant_name' => 'Bhavna Joshi',
        'bank_name' => 'ICICI Bank',
        'upi_id' => 'bhavna@okicici',
        'application_count' => 1,
        'profit_sharing_type' => 'fix',
        'funding_source' => 'user_money',
        'application_status' => 'approved',
        'settlement_status' => 'pending',
    ]);

    // Search by PAN: AAAPA
    $res1 = $this->actingAs($admin)->get('/applications?search=AAAPA1111A');
    $res1->assertOk();
    $page1 = $res1->original->getData()['page'];
    $data1 = $page1['props']['batches']['data'];
    expect(count($data1))->toBe(1)
        ->and($data1[0]['batch_number'])->toBe('BATCH-ALPHA-01');

    // Search by Bank name: ICICI
    $res2 = $this->actingAs($admin)->get('/applications?search=ICICI');
    $res2->assertOk();
    $page2 = $res2->original->getData()['page'];
    $data2 = $page2['props']['batches']['data'];
    expect(count($data2))->toBe(1)
        ->and($data2[0]['batch_number'])->toBe('BATCH-BETA-02');

    // Search by User name: Aarav
    $res3 = $this->actingAs($admin)->get('/applications?search=Aarav');
    $res3->assertOk();
    $page3 = $res3->original->getData()['page'];
    $data3 = $page3['props']['batches']['data'];
    expect(count($data3))->toBe(1)
        ->and($data3[0]['batch_number'])->toBe('BATCH-ALPHA-01');
});
