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
        Schema::create('ipos', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->string('symbol')->nullable()->index();
            $table->string('exchange', 20)->default('NSE');
            $table->string('ipo_type', 20)->default('mainboard')->index(); // 'mainboard', 'sme'
            $table->string('category', 50)->nullable();
            $table->date('open_date')->nullable()->index();
            $table->date('close_date')->nullable()->index();
            $table->date('allotment_date')->nullable();
            $table->date('listing_date')->nullable();
            $table->decimal('price_band_min', 12, 2)->nullable();
            $table->decimal('price_band_max', 12, 2)->nullable();
            $table->decimal('issue_price', 12, 2)->nullable();
            $table->unsignedInteger('lot_size')->default(1);
            $table->unsignedInteger('min_retail_qty')->nullable();
            $table->decimal('issue_size', 14, 2)->nullable(); // e.g. in Crores
            $table->decimal('gmp', 10, 2)->nullable();
            $table->string('status', 30)->default('upcoming')->index(); // 'upcoming', 'open', 'closed', 'allotted', 'listed'
            $table->string('provider', 50)->default('manual');
            $table->string('provider_id')->nullable()->index();
            $table->json('raw_provider_data')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ipos');
    }
};
