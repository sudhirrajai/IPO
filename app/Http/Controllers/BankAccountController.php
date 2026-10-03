<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BankAccountController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'bank_name' => 'required|string|max:100',
            'account_holder_name' => 'nullable|string|max:100',
        ]);

        $bank = BankAccount::firstOrCreate([
            'user_id' => $request->user()->id,
            'bank_name' => trim($validated['bank_name']),
        ], [
            'account_holder_name' => $validated['account_holder_name'] ?? null,
            'status' => 'active',
        ]);

        return back()->with('success', "Bank account '{$bank->bank_name}' saved successfully.");
    }

    public function destroy(Request $request, BankAccount $bankAccount): RedirectResponse
    {
        if ($bankAccount->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        $bankAccount->delete();

        return back()->with('success', 'Bank account removed.');
    }
}
