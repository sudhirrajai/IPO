<?php

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\User;
use App\Models\UserPan;
use App\Services\KfintechAllotmentService;
use Illuminate\Support\Facades\Http;

test('intelligent token matching matches Reliance Jio variations to JIO PLATFORMS LIMITED', function () {
    $activeIpos = [
        ['clientId' => '78061126051', 'name' => 'JIO PLATFORMS LIMITED'],
        ['clientId' => '29931891190', 'name' => 'ZETWERK MANUFACTURING BUSINESSES LIMITED'],
        ['clientId' => '32261845640', 'name' => 'FUSION CX LIMITED'],
    ];

    Cache::put('kfintech_active_ipos_list', $activeIpos, now()->addMinutes(10));

    $jio1 = new Ipo(['company_name' => 'Jio Platforms (Reliance Jio)', 'symbol' => 'JIOPLATFOR']);
    $match1 = KfintechAllotmentService::findMatchingKfinIpo($jio1);
    expect($match1)->not->toBeNull()
        ->and($match1['clientId'])->toBe('78061126051')
        ->and($match1['name'])->toBe('JIO PLATFORMS LIMITED');

    $jio2 = new Ipo(['company_name' => 'Jio Platforms Limited', 'symbol' => 'JIO']);
    $match2 = KfintechAllotmentService::findMatchingKfinIpo($jio2);
    expect($match2)->not->toBeNull()
        ->and($match2['clientId'])->toBe('78061126051');

    $zetwerk = new Ipo(['company_name' => 'Zetwerk', 'symbol' => 'ZETWERK']);
    $matchZet = KfintechAllotmentService::findMatchingKfinIpo($zetwerk);
    expect($matchZet)->not->toBeNull()
        ->and($matchZet['clientId'])->toBe('29931891190');
});

test('live kfintech query endpoint returns verified allotment and updates application batch', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $ipo = Ipo::create([
        'company_name' => 'Jio Platforms (Reliance Jio)',
        'symbol' => 'JIOPLATFOR',
        'exchange' => 'NSE',
        'lot_size' => 12,
        'kfin_client_id' => '78061126051',
        'status' => 'allotted',
    ]);

    $batch = ApplicationBatch::create([
        'user_id' => $admin->id,
        'ipo_id' => $ipo->id,
        'batch_number' => 'BATCH-JIO-001',
        'pan_number' => 'ABCDE1760R',
        'applicant_name' => 'Old Placeholder',
        'application_count' => 1,
        'profit_sharing_type' => 'fix',
        'funding_source' => 'user_money',
        'application_status' => 'submitted',
        'settlement_status' => 'pending',
    ]);

    Http::fake([
        '*execute-api.ap-south-1.amazonaws.com*' => Http::response([
            [
                'Appln_No' => 'VUR72411912574',
                'Name' => 'SUDHIR NARENDRAKUMAR RAJAI',
                'All_Shares' => '12',
                'App_Shares' => '12',
                'DP_CLID' => '1208180000094848',
                'Pan_No' => 'XXXXXX760R',
            ],
        ], 200),
    ]);

    $response = $this->actingAs($admin)->postJson("/ipos/{$ipo->id}/kfintech-live-check", [
        'identifier' => 'ABCDE1760R',
        'type' => 'pan',
        'batch_id' => $batch->id,
    ]);

    $response->assertOk()
        ->assertJson([
            'success' => true,
            'found' => true,
            'allotted' => true,
            'all_shares' => 12,
            'app_shares' => 12,
            'name_from_pan' => 'SUDHIR NARENDRAKUMAR RAJAI',
            'application_number' => 'VUR72411912574',
        ]);

    $batch->refresh();
    expect($batch->applicant_name)->toBe('SUDHIR NARENDRAKUMAR RAJAI')
        ->and($batch->application_status)->toBe('allotted')
        ->and($batch->allotment_details['allotted_shares'])->toBe(12)
        ->and($batch->allotment_details['source'])->toBe('kfintech');
});

test('checkAllotments executes instantly with kfintech provider', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $ipo = Ipo::create([
        'company_name' => 'Jio Platforms (Reliance Jio)',
        'symbol' => 'JIOPLATFOR',
        'exchange' => 'NSE',
        'lot_size' => 12,
        'kfin_client_id' => '78061126051',
        'status' => 'allotted',
    ]);

    $batch = ApplicationBatch::create([
        'user_id' => $admin->id,
        'ipo_id' => $ipo->id,
        'batch_number' => 'BATCH-JIO-002',
        'pan_number' => 'ABCDE1760R',
        'applicant_name' => 'Sudhir Rajai',
        'application_count' => 1,
        'profit_sharing_type' => 'fix',
        'funding_source' => 'user_money',
        'application_status' => 'submitted',
        'settlement_status' => 'pending',
    ]);

    Http::fake([
        '*execute-api.ap-south-1.amazonaws.com*' => Http::response([
            [
                'Appln_No' => 'VUR72411912574',
                'Name' => 'SUDHIR NARENDRAKUMAR RAJAI',
                'All_Shares' => '12',
                'App_Shares' => '12',
                'DP_CLID' => '1208180000094848',
                'Pan_No' => 'XXXXXX760R',
            ],
        ], 200),
    ]);

    $response = $this->actingAs($admin)->post("/ipos/{$ipo->id}/check-allotments", [
        'provider' => 'kfintech',
    ]);

    $response->assertRedirect();
    $batch->refresh();
    expect($batch->application_status)->toBe('allotted')
        ->and($batch->allotment_details['allotted_shares'])->toBe(12);
});
