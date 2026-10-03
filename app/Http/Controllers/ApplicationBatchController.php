<?php

namespace App\Http\Controllers;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\User;
use App\Services\ApplicationBatchService;
use App\Services\AuditService;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ApplicationBatchController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();

        $query = ApplicationBatch::with(['ipo', 'user', 'rate', 'batchPans.userPan', 'settlement']);

        if (! $isAdmin) {
            $query->where('user_id', $user->id);
        } elseif ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('ipo_id')) {
            $query->where('ipo_id', $request->ipo_id);
        }

        if ($request->filled('funding_source')) {
            $query->where('funding_source', $request->funding_source);
        }

        if ($request->filled('application_status')) {
            $query->where('application_status', $request->application_status);
        }

        if ($request->filled('settlement_status')) {
            $query->where('settlement_status', $request->settlement_status);
        }

        $batches = $query->orderByDesc('id')->paginate(15)->withQueryString();

        if (! $isAdmin) {
            $batches->getCollection()->makeHidden([
                'expected_net_earnings',
                'settled_net_earnings',
                'expected_gross_profit',
                'settled_gross_profit',
                'trader_rate_snapshot',
                'margin_snapshot',
            ]);
        }

        $ipos = Ipo::select(['id', 'company_name', 'symbol', 'status'])->orderBy('company_name')->get();
        $users = $isAdmin ? User::select(['id', 'name', 'email'])->orderBy('name')->get() : [];

        return Inertia::render('applications/index', [
            'batches' => $batches,
            'ipos' => $ipos,
            'users' => $users,
            'filters' => $request->only(['ipo_id', 'user_id', 'funding_source', 'application_status', 'settlement_status']),
            'isAdmin' => $isAdmin,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();

        $rules = [
            'ipo_id' => 'required|exists:ipos,id',
            'application_count' => 'nullable|integer|min:1|max:500',
            'funding_source' => 'nullable|in:my_money,user_money',
            'applicant_name' => 'nullable|string|max:150',
            'bank_name' => 'nullable|string|max:100',
            'pan_number' => 'nullable|string|max:10',
            'upi_id' => 'nullable|string|max:100',
            'upi_app' => 'nullable|string|max:50',
            'profit_sharing_type' => 'nullable|in:fix,percentage,rate_margin',
            'profit_sharing_value' => 'nullable|numeric|min:0',
            'pan_ids' => 'nullable|array',
            'pan_ids.*' => 'exists:user_pans,id',
            'notes' => 'nullable|string|max:500',
            'submission_date' => 'nullable|date',
            'trader_reference' => 'nullable|string|max:100',
            'capital_per_application' => 'nullable|numeric|min:0',
        ];

        if ($isAdmin) {
            $rules['user_id'] = 'nullable|exists:users,id';
            $rules['override_trader_rate'] = 'nullable|numeric|min:0';
            $rules['override_published_rate'] = 'nullable|numeric|min:0';
        }

        $validated = $request->validate($rules);

        if (! $isAdmin || empty($validated['user_id'])) {
            $validated['user_id'] = $user->id;
        }

        $validated['application_count'] = (int) ($validated['application_count'] ?? 1);
        $validated['funding_source'] = $isAdmin
            ? ($validated['funding_source'] ?? 'my_money')
            : 'user_money';

        try {
            $batch = ApplicationBatchService::createBatch($validated, $isAdmin);

            return back()->with('success', "Application batch {$batch->batch_number} created successfully.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function updateStatus(Request $request, ApplicationBatch $batch): RedirectResponse
    {
        $user = $request->user();
        if (! $user->isAdmin() && $batch->user_id !== $user->id) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'application_status' => 'required|in:draft,ready,submitted,confirmed,pending_allotment,allotted,not_allotted,cancelled',
            'note' => 'nullable|string|max:255',
        ]);

        ApplicationBatchService::updateStatus($batch, $validated['application_status'], $validated['note'] ?? null);

        $statusLabel = match($validated['application_status']) {
            'allotted' => 'Allotted (Profits & Capital Settled)',
            'not_allotted' => 'Not Allotted (Capital Released)',
            default => ucfirst(str_replace('_', ' ', $validated['application_status'])),
        };

        return back()->with('success', "Application {$batch->batch_number} marked as {$statusLabel}.");
    }

    public function cancel(Request $request, ApplicationBatch $batch): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:255',
        ]);

        $batch->update([
            'application_status' => 'cancelled',
            'settlement_status' => 'cancelled',
            'notes' => $batch->notes."\nCancellation reason: ".$validated['reason'],
        ]);

        AuditService::log('batch_cancelled', $batch, null, $validated, "Cancelled batch {$batch->batch_number}");

        return back()->with('success', "Application batch {$batch->batch_number} has been cancelled.");
    }
}
