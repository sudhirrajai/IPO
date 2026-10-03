<?php

namespace App\Http\Controllers;

use App\Models\ApplicationBatch;
use App\Models\Settlement;
use App\Services\AuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SettlementController extends Controller
{
    public function store(Request $request, ApplicationBatch $batch): RedirectResponse
    {
        $validated = $request->validate([
            'settlement_date' => 'required|date',
            'actual_gross_profit' => 'required|numeric|min:0',
            'actual_user_payout' => 'required|numeric|min:0',
            'actual_net_earnings' => 'required|numeric',
            'capital_returned' => 'required|numeric|min:0',
            'settlement_method' => 'required|string|max:50',
            'notes' => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($batch, $validated) {
            $settlement = Settlement::create([
                'application_batch_id' => $batch->id,
                'settlement_date' => $validated['settlement_date'],
                'actual_gross_profit' => $validated['actual_gross_profit'],
                'actual_user_payout' => $validated['actual_user_payout'],
                'actual_net_earnings' => $validated['actual_net_earnings'],
                'capital_returned' => $validated['capital_returned'],
                'settlement_method' => $validated['settlement_method'],
                'notes' => $validated['notes'] ?? null,
                'settled_by_user_id' => Auth::id(),
            ]);

            $batch->update([
                'settled_gross_profit' => $validated['actual_gross_profit'],
                'settled_user_payout' => $validated['actual_user_payout'],
                'settled_net_earnings' => $validated['actual_net_earnings'],
                'capital_returned' => $validated['capital_returned'],
                'settlement_status' => 'settled',
                'application_status' => 'allotted',
            ]);

            AuditService::log(
                'batch_settled',
                $batch,
                null,
                $validated,
                "Settled batch {$batch->batch_number}: Realized net earnings ₹{$validated['actual_net_earnings']}, User payout ₹{$validated['actual_user_payout']}"
            );
        });

        return back()->with('success', "Batch {$batch->batch_number} settled successfully.");
    }
}
