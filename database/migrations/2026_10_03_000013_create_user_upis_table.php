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
        Schema::create('user_upis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bank_account_id')->nullable()->constrained('bank_accounts')->nullOnDelete();
            $table->string('upi_id', 100);
            $table->string('upi_app', 50)->default('Other'); // 'Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Cred', 'Amazon Pay', 'Other'
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->unique(['user_id', 'upi_id']);
        });

        Schema::table('application_batches', function (Blueprint $table) {
            $table->string('upi_app', 50)->nullable()->after('upi_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_batches', function (Blueprint $table) {
            $table->dropColumn('upi_app');
        });

        Schema::dropIfExists('user_upis');
    }
};
