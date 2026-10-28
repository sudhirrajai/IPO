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
            $table->decimal('listing_price', 12, 2)->nullable()->after('issue_price');
            $table->decimal('base_price_per_lot', 12, 2)->nullable()->after('listing_price');
            $table->decimal('listing_profit_per_lot', 12, 2)->nullable()->after('base_price_per_lot');
        });

        Schema::table('application_batches', function (Blueprint $table) {
            $table->decimal('listing_profit', 12, 2)->nullable()->after('capital_returned');
            $table->decimal('user_collectible_amount', 12, 2)->nullable()->after('listing_profit');
            $table->decimal('trader_payable_amount', 12, 2)->nullable()->after('user_collectible_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ipos', function (Blueprint $table) {
            $table->dropColumn([
                'listing_price',
                'base_price_per_lot',
                'listing_profit_per_lot',
            ]);
        });

        Schema::table('application_batches', function (Blueprint $table) {
            $table->dropColumn([
                'listing_profit',
                'user_collectible_amount',
                'trader_payable_amount',
            ]);
        });
    }
};
