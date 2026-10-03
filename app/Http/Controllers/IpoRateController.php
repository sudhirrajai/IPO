<?php

namespace App\Http\Controllers;

use App\Models\Ipo;
use App\Services\IpoRateService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class IpoRateController extends Controller
{
    public function store(Request $request, Ipo $ipo): RedirectResponse
    {
        $validated = $request->validate([
            'trader_rate' => 'required|numeric|min:0',
            'published_rate' => 'required|numeric|min:0',
            'note' => 'nullable|string|max:255',
            'allow_negative_margin' => 'boolean',
        ]);

        try {
            IpoRateService::setRate(
                $ipo,
                (float) $validated['trader_rate'],
                (float) $validated['published_rate'],
                $validated['note'] ?? null,
                (bool) ($validated['allow_negative_margin'] ?? false)
            );

            return back()->with('success', 'Rates configured successfully. All new applications will snapshot this rate.');
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
