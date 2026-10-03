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
        // Automatically ensure dynamic status alignment with current date
        Ipo::recalculateStatuses();

        $counts = [
            'all' => Ipo::count(),
            'open' => Ipo::open()->count(),
            'upcoming' => Ipo::upcoming()->count(),
            'closed' => Ipo::closed()->count(),
        ];

        $query = Ipo::with('activeRate');

        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'open') {
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
            $search = '%'.$request->search.'%';
            $query->where(function ($q) use ($search) {
                $q->where('company_name', 'like', $search)
                    ->orWhere('symbol', 'like', $search);
            });
        }

        $ipos = $query->withCount(['applicationBatches as total_applications' => function ($q) {
            $q->selectRaw('COALESCE(SUM(application_count), 0)');
        }])
            ->orderByRaw("CASE WHEN status = 'open' THEN 1 WHEN status = 'upcoming' THEN 2 ELSE 3 END")
            ->orderBy('open_date')
            ->paginate(12)
            ->withQueryString();

        return Inertia::render('ipos/index', [
            'ipos' => $ipos,
            'counts' => $counts,
            'filters' => $request->only(['status', 'type', 'search']),
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

        $financials = [
            'total_applications' => (int) $batches->sum('application_count'),
            'my_money' => [
                'applications' => (int) $myMoneyBatches->sum('application_count'),
                'capital_deployed' => (float) $myMoneyBatches->sum('capital_amount'),
                'expected_gross_profit' => (float) $myMoneyBatches->sum('expected_gross_profit'),
                'expected_user_payout' => (float) $myMoneyBatches->sum('expected_user_payout'),
                'expected_net_earnings' => (float) $myMoneyBatches->sum('expected_net_earnings'),
                'realized_net_earnings' => (float) $myMoneyBatches->sum('settled_net_earnings'),
                'capital_returned' => (float) $myMoneyBatches->sum('capital_returned'),
            ],
            'user_money' => [
                'applications' => (int) $userMoneyBatches->sum('application_count'),
                'capital_recorded' => (float) $userMoneyBatches->sum('capital_amount'),
                'expected_gross_profit' => (float) $userMoneyBatches->sum('expected_gross_profit'),
                'expected_user_payout' => (float) $userMoneyBatches->sum('expected_user_payout'),
                'expected_net_earnings' => (float) $userMoneyBatches->sum('expected_net_earnings'),
                'realized_net_earnings' => (float) $userMoneyBatches->sum('settled_net_earnings'),
            ],
        ];

        // Eligible users list for Admin batch creation dropdown
        $usersList = $isAdmin
            ? User::where('status', 'active')->select(['id', 'name', 'email'])->with('pans')->get()
            : [];

        // Current user saved PANs for application form
        $userPans = $user->pans()->where('status', 'active')->get();

        // Saved Bank Accounts for quick selection with linked UPI IDs
        $bankAccounts = \App\Models\BankAccount::with('upis')
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderBy('bank_name')
            ->get();

        // All saved UPI IDs for this user
        $userUpis = \App\Models\UserUpi::with('bankAccount')
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderBy('upi_id')
            ->get();

        return Inertia::render('ipos/show', [
            'ipo' => $ipo,
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

        AuditService::log('ipo_gmp_updated', $ipo, ['gmp' => $oldGmp], ['gmp' => $newGmp], "Updated GMP for {$ipo->company_name} to " . ($newGmp !== null ? "₹{$newGmp}" : 'N/A'));

        return back()->with('success', 'Grey Market Premium (GMP) updated to ' . ($newGmp !== null ? "₹{$newGmp}" : 'N/A') . '.');
    }

    public function destroy(Ipo $ipo): RedirectResponse
    {
        $ipo->update(['status' => 'closed']);
        AuditService::log('ipo_archived', $ipo, null, null, "Archived IPO {$ipo->company_name}");

        return redirect()->route('ipos.index')->with('success', 'IPO marked as closed.');
    }
}
