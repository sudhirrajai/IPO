<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('application_batches', function (Blueprint $table) {
            $table->string('applicant_name')->nullable()->after('user_id');
            $table->string('bank_name')->nullable()->after('applicant_name');
            $table->string('pan_number', 10)->nullable()->after('bank_name');
            $table->string('upi_id')->nullable()->after('pan_number');
            $table->string('profit_sharing_type', 30)->default('rate_margin')->after('funding_source'); // 'fix', 'percentage', 'rate_margin'
            $table->decimal('profit_sharing_value', 12, 2)->nullable()->after('profit_sharing_type');
            $table->decimal('gmp_snapshot', 10, 2)->nullable()->after('margin_snapshot');
            $table->decimal('ipo_amount', 14, 2)->nullable()->after('capital_amount');

            // Make rate snapshots nullable / default 0 for rate-free direct application filling
            $table->decimal('trader_rate_snapshot', 12, 2)->default(0)->change();
            $table->decimal('published_rate_snapshot', 12, 2)->default(0)->change();
            $table->decimal('margin_snapshot', 12, 2)->default(0)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_batches', function (Blueprint $table) {
            $table->dropColumn([
                'applicant_name',
                'bank_name',
                'pan_number',
                'upi_id',
                'profit_sharing_type',
                'profit_sharing_value',
                'gmp_snapshot',
                'ipo_amount',
            ]);
        });
    }
};
