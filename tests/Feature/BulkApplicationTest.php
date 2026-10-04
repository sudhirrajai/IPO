<?php

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\Ipo;
use App\Models\IpoRate;
use App\Models\User;
use App\Models\UserPan;

test('regular user can apply in bulk using multiple saved PAN cards', function () {
    $user = User::factory()->create(['role' => 'user']);
    $ipo = Ipo::create([
        'company_name' => 'Tata Technologies Ltd',
        'symbol' => 'TATATECH',
        'exchange' => 'NSE',
        'lot_size' => 100,
        'issue_price' => 150,
        'price_band_max' => 150,
        'gmp' => 30,
        'status' => 'bidding_open',
    ]);
    IpoRate::create([
        'ipo_id' => $ipo->id,
        'trader_rate' => 1500,
        'published_rate' => 1200,
        'margin' => 300,
        'is_active' => true,
    ]);

    $pan1 = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'ABCDE1111A',
        'account_holder_name' => 'Rahul Sharma',
        'status' => 'active',
    ]);
    $pan2 = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'BCDEF2222B',
        'account_holder_name' => 'Pooja Sharma',
        'status' => 'active',
    ]);
    $pan3 = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'CDEFG3333C',
        'account_holder_name' => 'Amit Sharma',
        'status' => 'active',
    ]);

    $response = $this->actingAs($user)->post('/applications', [
        'ipo_id' => $ipo->id,
        'pan_ids' => [$pan1->id, $pan2->id, $pan3->id],
        'bank_name' => 'HDFC Bank',
        'upi_id' => 'rahul@okhdfc',
        'profit_sharing_type' => 'rate_margin',
    ]);

    $response->assertRedirect();

    $batches = ApplicationBatch::where('ipo_id', $ipo->id)
        ->where('user_id', $user->id)
        ->orderBy('id')
        ->get();

    expect($batches)->toHaveCount(3);

    // Each batch should be an individual application entry with count 1
    expect($batches[0]->application_count)->toBe(1)
        ->and($batches[0]->pan_number)->toBe('ABCDE1111A')
        ->and($batches[0]->applicant_name)->toBe('Rahul Sharma')
        ->and((float) $batches[0]->expected_user_payout)->toBe(1200.0)
        ->and($batches[0]->funding_source)->toBe('user_money');

    expect($batches[1]->application_count)->toBe(1)
        ->and($batches[1]->pan_number)->toBe('BCDEF2222B')
        ->and($batches[1]->applicant_name)->toBe('Pooja Sharma')
        ->and((float) $batches[1]->expected_user_payout)->toBe(1200.0);

    expect($batches[2]->application_count)->toBe(1)
        ->and($batches[2]->pan_number)->toBe('CDEFG3333C')
        ->and($batches[2]->applicant_name)->toBe('Amit Sharma')
        ->and((float) $batches[2]->expected_user_payout)->toBe(1200.0);

    // Total expected payout across entries
    expect((float) $batches->sum('expected_user_payout'))->toBe(3600.0);
});

test('admin can apply in bulk using PAN cards across users with chosen funding source', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $friend = User::factory()->create(['role' => 'user']);
    $ipo = Ipo::create([
        'company_name' => 'Adani Energy Ltd',
        'symbol' => 'ADANIEN',
        'exchange' => 'BSE',
        'lot_size' => 50,
        'issue_price' => 200,
        'price_band_max' => 200,
        'gmp' => 50,
        'status' => 'bidding_open',
    ]);
    IpoRate::create([
        'ipo_id' => $ipo->id,
        'trader_rate' => 2000,
        'published_rate' => 1700,
        'margin' => 300,
        'is_active' => true,
    ]);

    $pan1 = UserPan::create([
        'user_id' => $friend->id,
        'pan_number' => 'KLMNO4444D',
        'account_holder_name' => 'Vikram Singh',
        'status' => 'active',
    ]);
    $pan2 = UserPan::create([
        'user_id' => $friend->id,
        'pan_number' => 'MNOPQ5555E',
        'account_holder_name' => 'Sunita Singh',
        'status' => 'active',
    ]);

    $response = $this->actingAs($admin)->post('/applications', [
        'ipo_id' => $ipo->id,
        'user_id' => $friend->id,
        'pan_ids' => [$pan1->id, $pan2->id],
        'bank_name' => 'ICICI Bank',
        'funding_source' => 'my_money',
        'profit_sharing_type' => 'rate_margin',
        'trader_reference' => 'TR-BULK-01',
    ]);

    $response->assertRedirect();

    $batches = ApplicationBatch::where('ipo_id', $ipo->id)
        ->where('user_id', $friend->id)
        ->orderBy('id')
        ->get();

    expect($batches)->toHaveCount(2);

    expect($batches[0]->application_count)->toBe(1)
        ->and($batches[0]->pan_number)->toBe('KLMNO4444D')
        ->and($batches[0]->applicant_name)->toBe('Vikram Singh')
        ->and((float) $batches[0]->expected_user_payout)->toBe(1700.0)
        ->and((float) $batches[0]->expected_net_earnings)->toBe(300.0)
        ->and($batches[0]->funding_source)->toBe('my_money')
        ->and($batches[0]->trader_reference)->toBe('TR-BULK-01');

    expect($batches[1]->application_count)->toBe(1)
        ->and($batches[1]->pan_number)->toBe('MNOPQ5555E')
        ->and($batches[1]->applicant_name)->toBe('Sunita Singh')
        ->and((float) $batches[1]->expected_user_payout)->toBe(1700.0)
        ->and((float) $batches[1]->expected_net_earnings)->toBe(300.0)
        ->and($batches[1]->funding_source)->toBe('my_money');

    expect((float) $batches->sum('expected_user_payout'))->toBe(3400.0)
        ->and((float) $batches->sum('expected_net_earnings'))->toBe(600.0);
});
