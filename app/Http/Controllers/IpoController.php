<?php

namespace App\Http\Controllers;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IpoController extends Controller
{
    public function index(Request $request): Response
    {
        // Automatically ensure dynamic status alignment with current date and deduplicate records
        Ipo::recalculateStatuses();
        Ipo::deduplicate();

        $user = $request->user();
        $userFavoritesCount = $user ? $user->favoriteIpos()->count() : 0;

        $counts = [
            'all' => Ipo::count(),
            'favorites' => $userFavoritesCount,
            'open' => Ipo::open()->count(),
            'upcoming' => Ipo::upcoming()->count(),
            'closed' => Ipo::closed()->count(),
        ];

        $query = Ipo::with('activeRate');

        if ($user) {
            $query->withExists(['favoritedByUsers as is_favorite' => function ($q) use ($user) {
                $q->where('user_id', $user->id);
            }]);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'favorites') {
                if ($user) {
                    $favoriteIpoIds = $user->favoriteIpos()->pluck('ipos.id')->toArray();
                    $query->whereIn('ipos.id', $favoriteIpoIds);
                } else {
                    $query->whereRaw('1 = 0');
                }
            } elseif ($request->status === 'open') {
                $query->open();
            } elseif ($request->status === 'upcoming') {
                $query->upcoming();
            } elseif ($request->status === 'closed') {
                $query->closed();
            } else {
                $query->where('status', $request->status);
            }
        }

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('ipo_type', $request->type);
        }

        if ($request->filled('search')) {
            $search = '%'.trim($request->search).'%';
            $query->where(function ($q) use ($search) {
                $q->where('company_name', 'like', $search)
                    ->orWhere('symbol', 'like', $search)
                    ->orWhere('category', 'like', $search)
                    ->orWhere('exchange', 'like', $search);
            });
        }

        $sort = $request->input('sort', 'default');
        match ($sort) {
            'gmp_desc' => $query->orderByDesc('gmp'),
            'gmp_asc' => $query->orderBy('gmp'),
            'date_open' => $query->orderBy('open_date'),
            'date_close' => $query->orderBy('close_date'),
            'allotment' => $query->orderBy('allotment_date'),
            'name_asc' => $query->orderBy('company_name'),
            default => $query->orderByRaw("CASE WHEN status = 'open' THEN 1 WHEN status = 'upcoming' THEN 2 ELSE 3 END")
                ->orderBy('open_date'),
        };

        $ipos = $query->withCount(['applicationBatches as total_applications' => function ($q) {
            $q->selectRaw('COALESCE(SUM(application_count), 0)');
        }])
            ->paginate(24)
            ->withQueryString();

        return Inertia::render('ipos/index', [
            'ipos' => $ipos,
            'counts' => $counts,
            'filters' => [
                'status' => $request->input('status', 'all'),
                'type' => $request->input('type', 'all'),
                'search' => $request->input('search', ''),
                'sort' => $request->input('sort', 'default'),
            ],
        ]);
    }


    public function show(Request $request, Ipo $ipo): Response
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();

        $ipo->load([
            'activeRate',
            'rates.creator',
        ]);

        // Application Batches
        $batchesQuery = ApplicationBatch::with(['user', 'rate', 'batchPans.userPan', 'settlement'])
            ->where('ipo_id', $ipo->id);

        if (! $isAdmin) {
            // Regular user only sees own batches!
            $batchesQuery->where('user_id', $user->id);
        }

        $batches = $batchesQuery->orderByDesc('id')->get();

        // Calculate workspace financial aggregates
        $myMoneyBatches = $batches->where('funding_source', 'my_money');
        $userMoneyBatches = $batches->where('funding_source', 'user_money');

        if (! $isAdmin) {
            if ($ipo->activeRate) {
                $ipo->activeRate->makeHidden(['trader_rate', 'margin']);
            }
            $ipo->rates->each(fn ($rate) => $rate->makeHidden(['trader_rate', 'margin']));
            $batches->makeHidden([
                'expected_net_earnings',
                'settled_net_earnings',
                'expected_gross_profit',
                'settled_gross_profit',
            ]);
        }

        $financials = [
            'total_applications' => (int) $batches->sum('application_count'),
            'my_money' => [
                'applications' => (int) $myMoneyBatches->sum('application_count'),
                'capital_deployed' => (float) $myMoneyBatches->sum('capital_amount'),
                'expected_gross_profit' => (float) $myMoneyBatches->sum('expected_gross_profit'),
                'expected_user_payout' => (float) $myMoneyBatches->sum('expected_user_payout'),
                'expected_net_earnings' => $isAdmin ? (float) $myMoneyBatches->sum('expected_net_earnings') : 0,
                'realized_net_earnings' => $isAdmin ? (float) $myMoneyBatches->sum('settled_net_earnings') : 0,
                'capital_returned' => (float) $myMoneyBatches->sum('capital_returned'),
            ],
            'user_money' => [
                'applications' => (int) $userMoneyBatches->sum('application_count'),
                'capital_recorded' => (float) $userMoneyBatches->sum('capital_amount'),
                'expected_gross_profit' => (float) $userMoneyBatches->sum('expected_gross_profit'),
                'expected_user_payout' => (float) $userMoneyBatches->sum('expected_user_payout'),
                'expected_net_earnings' => $isAdmin ? (float) $userMoneyBatches->sum('expected_net_earnings') : 0,
                'realized_net_earnings' => $isAdmin ? (float) $userMoneyBatches->sum('settled_net_earnings') : 0,
            ],
        ];

        // Eligible users list for Admin batch creation dropdown
        $usersList = $isAdmin
            ? User::where('status', 'active')->select(['id', 'name', 'email'])->with('pans')->get()
            : [];

        // Saved PANs for application form (all active PANs for admin, user's own PANs for regular user)
        $userPans = $isAdmin
            ? \App\Models\UserPan::with('user:id,name')
                ->where('status', 'active')
                ->orderBy('account_holder_name')
                ->get()
            : $user->pans()
                ->where('status', 'active')
                ->orderBy('account_holder_name')
                ->get();

        // Saved Bank Accounts for quick selection with linked UPI IDs
        $bankAccounts = $isAdmin
            ? \App\Models\BankAccount::with(['user:id,name', 'upis'])->where('status', 'active')->orderBy('bank_name')->get()
            : \App\Models\BankAccount::with('upis')->where('user_id', $user->id)->where('status', 'active')->orderBy('bank_name')->get();

        // All saved UPI IDs
        $userUpis = $isAdmin
            ? \App\Models\UserUpi::with('bankAccount')->where('status', 'active')->orderBy('upi_id')->get()
            : \App\Models\UserUpi::with('bankAccount')->where('user_id', $user->id)->where('status', 'active')->orderBy('upi_id')->get();

        $isFavorite = $user ? $user->favoriteIpos()->where('ipo_id', $ipo->id)->exists() : false;

        return Inertia::render('ipos/show', [
            'ipo' => $ipo,
            'isFavorite' => $isFavorite,
            'batches' => $batches,
            'financials' => $financials,
            'usersList' => $usersList,
            'userPans' => $userPans,
            'bankAccounts' => $bankAccounts,
            'userUpis' => $userUpis,
            'isAdmin' => $isAdmin,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'company_name' => 'required|string|max:255',
            'symbol' => 'nullable|string|max:50',
            'exchange' => 'required|string|max:50',
            'ipo_type' => 'required|in:mainboard,sme',
            'category' => 'nullable|string|max:100',
            'open_date' => 'nullable|date',
            'close_date' => 'nullable|date|after_or_equal:open_date',
            'allotment_date' => 'nullable|date',
            'listing_date' => 'nullable|date',
            'price_band_min' => 'nullable|numeric|min:0',
            'price_band_max' => 'nullable|numeric|min:0',
            'issue_price' => 'nullable|numeric|min:0',
            'lot_size' => 'required|integer|min:1',
            'min_retail_qty' => 'nullable|integer|min:1',
            'issue_size' => 'nullable|numeric|min:0',
            'gmp' => 'nullable|numeric',
            'status' => 'required|in:upcoming,open,closed,allotted,listed',
        ]);

        $ipo = Ipo::create([
            ...$validated,
            'provider' => 'manual',
        ]);

        AuditService::log('ipo_created', $ipo, null, $validated, "Manually created IPO {$ipo->company_name}");

        return redirect()->route('ipos.show', $ipo->id)
            ->with('success', 'IPO created successfully.');
    }

    public function update(Request $request, Ipo $ipo): RedirectResponse
    {
        $validated = $request->validate([
            'company_name' => 'required|string|max:255',
            'symbol' => 'nullable|string|max:50',
            'exchange' => 'required|string|max:50',
            'ipo_type' => 'required|in:mainboard,sme',
            'category' => 'nullable|string|max:100',
            'open_date' => 'nullable|date',
            'close_date' => 'nullable|date|after_or_equal:open_date',
            'allotment_date' => 'nullable|date',
            'listing_date' => 'nullable|date',
            'price_band_min' => 'nullable|numeric|min:0',
            'price_band_max' => 'nullable|numeric|min:0',
            'issue_price' => 'nullable|numeric|min:0',
            'lot_size' => 'required|integer|min:1',
            'min_retail_qty' => 'nullable|integer|min:1',
            'issue_size' => 'nullable|numeric|min:0',
            'gmp' => 'nullable|numeric',
            'status' => 'required|in:upcoming,open,closed,allotted,listed',
        ]);

        $oldValues = $ipo->toArray();
        $ipo->update($validated);

        if (isset($validated['gmp']) && $validated['gmp'] !== null) {
            \App\Services\GmpScraperService::recalculatePercentageBatchesForIpo($ipo, (float) $validated['gmp']);
        }

        AuditService::log('ipo_updated', $ipo, $oldValues, $validated, "Updated IPO {$ipo->company_name}");

        return back()->with('success', 'IPO updated successfully.');
    }

    public function updateGmp(Request $request, Ipo $ipo): RedirectResponse
    {
        $validated = $request->validate([
            'gmp' => 'nullable|numeric',
        ]);

        $oldGmp = $ipo->gmp;
        $newGmp = isset($validated['gmp']) && $validated['gmp'] !== null && $validated['gmp'] !== ''
            ? (float) $validated['gmp']
            : null;

        $ipo->update([
            'gmp' => $newGmp,
        ]);

        if ($newGmp !== null) {
            \App\Services\GmpScraperService::recalculatePercentageBatchesForIpo($ipo, $newGmp);
        }

        AuditService::log('ipo_gmp_updated', $ipo, ['gmp' => $oldGmp], ['gmp' => $newGmp], "Updated GMP for {$ipo->company_name} to " . ($newGmp !== null ? "₹{$newGmp}" : 'N/A'));

        return back()->with('success', 'Grey Market Premium (GMP) updated to ' . ($newGmp !== null ? "₹{$newGmp}" : 'N/A') . '.');
    }

    public function updateListing(Request $request, Ipo $ipo): RedirectResponse
    {
        $user = $request->user();
        if (! $user || ! $user->isAdmin()) {
            abort(403, 'Only administrators can update listing details.');
        }

        $validated = $request->validate([
            'listing_price' => 'nullable|numeric|min:0',
            'base_price_per_lot' => 'nullable|numeric|min:0',
            'listing_profit_per_lot' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:upcoming,open,closed,allotment_out,listed',
        ]);

        $listingPrice = isset($validated['listing_price']) && $validated['listing_price'] !== ''
            ? (float) $validated['listing_price']
            : null;

        $basePricePerLot = isset($validated['base_price_per_lot']) && $validated['base_price_per_lot'] !== ''
            ? (float) $validated['base_price_per_lot']
            : null;

        $profitPerLot = isset($validated['listing_profit_per_lot']) && $validated['listing_profit_per_lot'] !== ''
            ? (float) $validated['listing_profit_per_lot']
            : null;

        // If profit per lot is not explicitly given, calculate it from listing price and base price / issue price
        if ($profitPerLot === null && $listingPrice !== null && $listingPrice > 0) {
            $lot = max(1, (int) ($ipo->lot_size ?? 1));
            if ($basePricePerLot !== null && $basePricePerLot > 0) {
                $profitPerLot = round(($listingPrice * $lot) - $basePricePerLot, 2);
            } elseif ($ipo->issue_price && (float) $ipo->issue_price > 0) {
                $profitPerLot = round(($listingPrice - (float) $ipo->issue_price) * $lot, 2);
            }
        }

        $status = $validated['status'] ?? ($listingPrice ? 'listed' : $ipo->status);

        $ipo->update([
            'listing_price' => $listingPrice,
            'base_price_per_lot' => $basePricePerLot,
            'listing_profit_per_lot' => $profitPerLot,
            'status' => $status,
        ]);

        $updatedBatchesCount = \App\Services\ApplicationBatchService::recalculateListingSettlementsForIpo($ipo);

        AuditService::log(
            'ipo_listing_updated',
            $ipo,
            null,
            $validated,
            "Updated listing price for {$ipo->company_name} to ₹{$listingPrice} (Profit/lot: ₹{$profitPerLot}). Recalculated {$updatedBatchesCount} allotted applications."
        );

        $formattedProfit = $profitPerLot !== null ? '₹' . number_format($profitPerLot, 2) : 'N/A';
        return back()->with('success', "Listing details updated. {$formattedProfit} profit per lot applied across {$updatedBatchesCount} allotted applications.");
    }

    public function destroy(Ipo $ipo): RedirectResponse
    {
        $ipo->update(['status' => 'closed']);
        AuditService::log('ipo_archived', $ipo, null, null, "Archived IPO {$ipo->company_name}");

        return redirect()->route('ipos.index')->with('success', 'IPO marked as closed.');
    }

    public function toggleFixApplications(Ipo $ipo): RedirectResponse
    {
        $ipo->accept_fix_applications = ! ($ipo->accept_fix_applications ?? true);
        $ipo->save();

        $state = $ipo->accept_fix_applications ? 'enabled' : 'disabled';
        AuditService::log('ipo_fix_toggle', $ipo, null, ['accept_fix_applications' => $ipo->accept_fix_applications], "Accepting fix rate applications is now {$state}");

        return back()->with('success', "Accepting fix rate applications is now {$state} for {$ipo->company_name}.");
    }

    public function toggleAutoApproveFix(Ipo $ipo): RedirectResponse
    {
        $ipo->auto_approve_fix = ! ($ipo->auto_approve_fix ?? true);
        $ipo->save();

        $state = $ipo->auto_approve_fix ? 'enabled' : 'disabled';
        AuditService::log('ipo_auto_approve_toggle', $ipo, null, ['auto_approve_fix' => $ipo->auto_approve_fix], "Auto-approval for fix applications is now {$state}");

        return back()->with('success', "Auto-approval for fix rate applications is now {$state} for {$ipo->company_name}.");
    }

    public function checkAllotments(Request $request, Ipo $ipo): RedirectResponse
    {
        $provider = strtolower((string) $request->input('provider', 'auto'));

        // Query batches for this IPO (exclude cancelled)
        $batchesQuery = $ipo->applicationBatches()
            ->whereNotIn('application_status', ['cancelled']);

        $count = $batchesQuery->count();

        // For small batch counts (<= 30) or when KFintech is selected, check synchronously for instant results
        if ($count > 0 && ($count <= 30 || $provider === 'kfintech' || $request->input('sync') === '1')) {
            $batches = $batchesQuery->get();
            $allotted = 0;
            $notAllotted = 0;
            $notFound = 0;

            foreach ($batches as $batch) {
                $res = \App\Services\ApplicationBatchService::executeCheckAllotment($batch, $provider);
                if ($res['success'] && ($res['found'] ?? false)) {
                    if ($res['allotted'] ?? false) {
                        $allotted++;
                    } else {
                        $notAllotted++;
                    }
                } else {
                    $notFound++;
                }
            }

            $ipo->updateQuietly(['allotment_scraped_at' => now()]);

            $provLabel = strtoupper($provider);
            $msg = "{$provLabel} allotment check complete for {$ipo->company_name}: {$allotted} allotted, {$notAllotted} not allotted";
            if ($notFound > 0) {
                $msg .= ", {$notFound} pending/not in registry";
            }
            $msg .= '.';

            return back()->with('success', $msg);
        }

        // Mark batches as checking immediately so the UI displays active spinners on next frame
        foreach ($batchesQuery->get() as $b) {
            \App\Services\ApplicationBatchService::markChecking($b);
        }

        \App\Jobs\CheckBulkAllotmentsJob::dispatch([], $ipo->id, $provider, $request->user()?->id);

        return back()->with('success', "Allotment check running for {$ipo->company_name}. Results will sync automatically.");
    }

    /**
     * Query KFintech portal live for any PAN, Application Number, or DP ID.
     */
    public function kfintechLiveCheck(Request $request, Ipo $ipo): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'identifier' => 'required|string|max:50',
            'type' => 'nullable|string|in:pan,appno,dpclid',
            'batch_id' => 'nullable|integer',
        ]);

        $type = $validated['type'] ?? 'pan';
        $identifier = trim((string) $validated['identifier']);

        $kfinMatch = \App\Services\KfintechAllotmentService::findMatchingKfinIpo($ipo);
        if (! $kfinMatch) {
            return response()->json([
                'success' => false,
                'found' => false,
                'status' => 'not_on_kfintech',
                'message' => "IPO {$ipo->company_name} is not currently registered on KFintech portal.",
            ]);
        }

        $result = \App\Services\KfintechAllotmentService::queryAllotment($identifier, $kfinMatch['clientId'], $type);
        $result['kfin_ipo_name'] = $kfinMatch['name'];
        $result['client_id'] = $kfinMatch['clientId'];

        // Optionally link and update batch if requested
        if (! empty($validated['batch_id']) && $result['success'] && $result['found']) {
            $batch = \App\Models\ApplicationBatch::find($validated['batch_id']);
            if ($batch && $batch->ipo_id === $ipo->id) {
                $batch->update([
                    'allotment_details' => [
                        'source' => 'kfintech',
                        'status' => $result['status'],
                        'found' => true,
                        'allotted' => $result['allotted'],
                        'allotted_shares' => $result['all_shares'],
                        'applied_shares' => $result['app_shares'],
                        'application_number' => $result['application_number'],
                        'name_from_pan' => $result['name_from_pan'],
                        'dp_clid' => $result['dp_clid'],
                        'pan_masked' => $result['pan_masked'],
                        'kfin_client_id' => $kfinMatch['clientId'],
                        'kfin_ipo_name' => $kfinMatch['name'],
                        'checked_at' => now()->toIso8601String(),
                    ],
                    'allotment_checked_at' => now(),
                    'applicant_name' => ! empty($result['name_from_pan']) ? trim((string) $result['name_from_pan']) : $batch->applicant_name,
                ]);

                $targetStatus = $result['allotted'] ? 'allotted' : 'not_allotted';
                \App\Services\ApplicationBatchService::updateStatus(
                    $batch,
                    $targetStatus,
                    "Live checked via KFintech Allotment Portal (Applied: {$result['app_shares']}, Allotted: {$result['all_shares']})"
                );

                if (! empty($result['name_from_pan']) && ! empty($batch->pan_number)) {
                    \App\Models\UserPan::where('pan_number', strtoupper($batch->pan_number))
                        ->update(['account_holder_name' => trim((string) $result['name_from_pan'])]);
                }
            }
        }

        return response()->json($result);
    }

    public function toggleFavorite(Request $request, Ipo $ipo): RedirectResponse
    {
        $user = $request->user();
        if (! $user) {
            return back();
        }

        $isFavorited = $user->favoriteIpos()->where('ipo_id', $ipo->id)->exists();
        if ($isFavorited) {
            $user->favoriteIpos()->detach($ipo->id);
            $msg = "Removed {$ipo->company_name} from favorites.";
        } else {
            $user->favoriteIpos()->attach($ipo->id);
            $msg = "Added {$ipo->company_name} to favorites.";
        }

        return back()->with('success', $msg);
    }
}

