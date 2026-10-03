<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\UserUpi;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class UserUpiController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'upi_id' => 'required|string|max:100',
            'bank_account_id' => 'nullable|exists:bank_accounts,id',
            'upi_app' => 'nullable|string|max:50',
        ]);

        $upiId = strtolower(trim($validated['upi_id']));
        $upiApp = ! empty($validated['upi_app']) && $validated['upi_app'] !== 'Auto'
            ? $validated['upi_app']
            : UserUpi::detectApp($upiId);

        $bankAccountId = $validated['bank_account_id'] ?? null;
        if ($bankAccountId) {
            $bank = BankAccount::find($bankAccountId);
            if ($bank && $bank->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
                abort(403);
            }
        }

        $userUpi = UserUpi::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'upi_id' => $upiId,
            ],
            [
                'bank_account_id' => $bankAccountId,
                'upi_app' => $upiApp,
                'status' => 'active',
            ]
        );

        return back()->with('success', "UPI ID '{$userUpi->upi_id}' ({$userUpi->upi_app}) saved successfully.");
    }

    public function update(Request $request, UserUpi $userUpi): RedirectResponse
    {
        if ($userUpi->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        $validated = $request->validate([
            'bank_account_id' => 'nullable|exists:bank_accounts,id',
            'upi_app' => 'nullable|string|max:50',
        ]);

        $userUpi->update([
            'bank_account_id' => $validated['bank_account_id'] ?? $userUpi->bank_account_id,
            'upi_app' => $validated['upi_app'] ?? $userUpi->upi_app,
        ]);

        return back()->with('success', "UPI ID updated.");
    }

    public function destroy(Request $request, UserUpi $userUpi): RedirectResponse
    {
        if ($userUpi->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            abort(403);
        }

        $userUpi->delete();

        return back()->with('success', "UPI ID removed.");
    }
}
