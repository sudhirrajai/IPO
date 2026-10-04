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
        Schema::table('ipos', function (Blueprint $table) {
            $table->boolean('accept_fix_applications')->default(true)->after('gmp');
            $table->boolean('auto_approve_fix')->default(true)->after('accept_fix_applications');
            $table->string('kfin_client_id')->nullable()->after('provider_id');
            $table->timestamp('allotment_scraped_at')->nullable()->after('last_synced_at');
        });

        Schema::table('application_batches', function (Blueprint $table) {
            $table->json('allotment_details')->nullable()->after('notes');
            $table->timestamp('allotment_checked_at')->nullable()->after('allotment_details');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ipos', function (Blueprint $table) {
            $table->dropColumn([
                'accept_fix_applications',
                'auto_approve_fix',
                'kfin_client_id',
                'allotment_scraped_at',
            ]);
        });

        Schema::table('application_batches', function (Blueprint $table) {
            $table->dropColumn([
                'allotment_details',
                'allotment_checked_at',
            ]);
        });
    }
};
