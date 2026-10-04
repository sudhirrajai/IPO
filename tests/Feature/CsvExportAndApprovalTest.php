<?php

namespace Tests\Feature;

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\Ipo;
use App\Models\IpoRate;
use App\Models\User;
use App\Models\UserPan;
use App\Services\ApplicationBatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CsvExportAndApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $user;
    protected Ipo $ipo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->user = User::factory()->create([
            'role' => 'user',
            'status' => 'active',
        ]);

        $this->ipo = Ipo::create([
            'company_name' => 'Tata Technologies Ltd',
            'symbol' => 'TATATECH',
            'exchange' => 'NSE',
            'lot_size' => 100,
            'issue_price' => 500,
            'status' => 'open',
            'auto_approve_fix' => false, // Auto-approval is OFF
            'accept_fix_applications' => true,
            'provider' => 'manual',
        ]);
    }

    public function test_applications_enter_pending_approval_when_auto_approve_is_off(): void
    {
        $batch = ApplicationBatchService::createBatch([
            'ipo_id' => $this->ipo->id,
            'user_id' => $this->user->id,
            'applicant_name' => 'Ramesh Sharma',
            'pan_number' => 'ABCDE1234F',
            'profit_sharing_type' => 'fix',
            'profit_sharing_value' => 1100,
            'application_count' => 1,
            'funding_source' => 'user_money',
        ], false);

        $this->assertEquals('pending_approval', $batch->application_status);

        // Admin can approve manually
        $response = $this->actingAs($this->admin)->post(route('applications.approve', $batch));
        $response->assertSessionHas('success');
        $this->assertEquals('confirmed', $batch->fresh()->application_status);
    }

    public function test_admin_can_bulk_approve_all_pending_applications(): void
    {
        for ($i = 1; $i <= 3; $i++) {
            ApplicationBatch::create([
                'batch_number' => "BATCH-PENDING-{$i}",
                'ipo_id' => $this->ipo->id,
                'user_id' => $this->user->id,
                'applicant_name' => "Applicant {$i}",
                'application_count' => 1,
                'application_status' => 'pending_approval',
                'submission_date' => now()->toDateString(),
            ]);
        }

        $this->assertEquals(3, ApplicationBatch::where('ipo_id', $this->ipo->id)->where('application_status', 'pending_approval')->count());

        $response = $this->actingAs($this->admin)->post(route('ipos.applications.approve-all', $this->ipo));
        $response->assertSessionHas('success');

        $this->assertEquals(0, ApplicationBatch::where('ipo_id', $this->ipo->id)->where('application_status', 'pending_approval')->count());
        $this->assertEquals(3, ApplicationBatch::where('ipo_id', $this->ipo->id)->where('application_status', 'confirmed')->count());
    }

    public function test_user_and_trader_csv_exports_with_rate_differences(): void
    {
        // Batch 1: Applied with Trader Rate 1300, User Rate 1100
        $pan1 = UserPan::create([
            'user_id' => $this->user->id,
            'pan_number' => 'ABCDE1111A',
            'account_holder_name' => 'User One',
            'status' => 'active',
        ]);

        $batch1 = ApplicationBatch::create([
            'batch_number' => 'BATCH-001',
            'ipo_id' => $this->ipo->id,
            'user_id' => $this->user->id,
            'applicant_name' => 'User One',
            'pan_number' => 'ABCDE1111A',
            'application_count' => 1,
            'trader_rate_snapshot' => 1300,
            'published_rate_snapshot' => 1100,
            'application_status' => 'confirmed',
            'submission_date' => now()->toDateString(),
        ]);

        ApplicationBatchPan::create([
            'application_batch_id' => $batch1->id,
            'user_pan_id' => $pan1->id,
            'sequence_number' => 1,
            'pan_number_snapshot' => 'ABCDE1111A',
        ]);

        // Batch 2: Rates updated later to Trader Rate 1500, User Rate 1300
        $pan2 = UserPan::create([
            'user_id' => $this->user->id,
            'pan_number' => 'FGHIJ2222B',
            'account_holder_name' => 'User Two',
            'status' => 'active',
        ]);

        $batch2 = ApplicationBatch::create([
            'batch_number' => 'BATCH-002',
            'ipo_id' => $this->ipo->id,
            'user_id' => $this->user->id,
            'applicant_name' => 'User Two',
            'pan_number' => 'FGHIJ2222B',
            'application_count' => 1,
            'trader_rate_snapshot' => 1500,
            'published_rate_snapshot' => 1300,
            'application_status' => 'confirmed',
            'submission_date' => now()->toDateString(),
        ]);

        ApplicationBatchPan::create([
            'application_batch_id' => $batch2->id,
            'user_pan_id' => $pan2->id,
            'sequence_number' => 1,
            'pan_number_snapshot' => 'FGHIJ2222B',
        ]);

        // 1. Test User Rates CSV
        $userCsvResponse = $this->actingAs($this->admin)->get(route('ipos.export.user-csv', $this->ipo));
        $userCsvResponse->assertOk();
        $userCsvContent = $userCsvResponse->streamedContent();

        // Check columns
        $this->assertStringContainsString('"Serial No","Name of PAN Holder","PAN Number","Rate Applied"', $userCsvContent);
        // Row 1: Serial 1, User One, ABCDE1111A, 1100
        $this->assertStringContainsString('1,"User One",ABCDE1111A,1100', $userCsvContent);
        // Row 2: Serial 2, User Two, FGHIJ2222B, 1300
        $this->assertStringContainsString('2,"User Two",FGHIJ2222B,1300', $userCsvContent);

        // 2. Test Trader Rates CSV
        $traderCsvResponse = $this->actingAs($this->admin)->get(route('ipos.export.trader-csv', $this->ipo));
        $traderCsvResponse->assertOk();
        $traderCsvContent = $traderCsvResponse->streamedContent();

        // Check columns
        $this->assertStringContainsString('"Serial No","Name of PAN Holder","PAN Number","Trader Rate"', $traderCsvContent);
        // Row 1: Serial 1, User One, ABCDE1111A, 1300
        $this->assertStringContainsString('1,"User One",ABCDE1111A,1300', $traderCsvContent);
        // Row 2: Serial 2, User Two, FGHIJ2222B, 1500
        $this->assertStringContainsString('2,"User Two",FGHIJ2222B,1500', $traderCsvContent);
    }
}
