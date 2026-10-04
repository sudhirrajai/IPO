<?php

namespace App\Http\Controllers;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\User;
use App\Models\UserPan;
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
        $today = now('Asia/Kolkata')->format('Y-m-d');

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

        if ($request->filled('allotment_today') && $request->allotment_today === '1') {
            $query->whereHas('ipo', function ($q) use ($today) {
                $q->whereDate('allotment_date', $today);
            });
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('pan_number', 'like', "%{$search}%")
                    ->orWhere('applicant_name', 'like', "%{$search}%")
                    ->orWhere('batch_number', 'like', "%{$search}%")
                    ->orWhere('bank_name', 'like', "%{$search}%")
                    ->orWhere('upi_id', 'like', "%{$search}%")
                    ->orWhereHas('batchPans', function ($bp) use ($search) {
                        $bp->where('pan_number_snapshot', 'like', "%{$search}%");
                    });
            });
        }

        // Count batches whose IPO allotment is today
        $todayQuery = ApplicationBatch::whereHas('ipo', function ($q) use ($today) {
            $q->whereDate('allotment_date', $today);
        });
        if (! $isAdmin) {
            $todayQuery->where('user_id', $user->id);
        }
        $allotmentTodayCount = $todayQuery->count();

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

        $ipos = Ipo::select(['id', 'company_name', 'symbol', 'status', 'allotment_date'])->orderBy('company_name')->get();
        $users = $isAdmin ? User::select(['id', 'name', 'email'])->orderBy('name')->get() : [];

        $userPans = $isAdmin
            ? UserPan::with('user:id,name')->where('status', 'active')->orderBy('account_holder_name')->get()
            : UserPan::where('user_id', $user->id)->where('status', 'active')->orderBy('account_holder_name')->get();

        return Inertia::render('applications/index', [
            'batches' => $batches,
            'ipos' => $ipos,
            'users' => $users,
            'userPans' => $userPans,
            'allotmentTodayCount' => $allotmentTodayCount,
            'filters' => $request->only(['ipo_id', 'user_id', 'funding_source', 'application_status', 'settlement_status', 'search', 'allotment_today']),
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

    public function destroy(Request $request, ApplicationBatch $batch): RedirectResponse
    {
        $user = $request->user();
        if (! $user->isAdmin() && $batch->user_id !== $user->id) {
            abort(403, 'Unauthorized to delete this application.');
        }

        if ($batch->settlement_status === 'settled') {
            return back()->with('error', 'Cannot delete an application batch that has already been settled.');
        }

        $batchNumber = $batch->batch_number;

        AuditService::log('batch_deleted', $batch, $batch->toArray(), ['deleted_by' => $user->name]);

        // Clean up linked batch pans
        $batch->batchPans()->delete();
        $batch->delete();

        return back()->with('success', "Application {$batchNumber} was deleted successfully.");
    }

    public function checkAllotment(Request $request, ApplicationBatch $batch): \Illuminate\Http\JsonResponse|RedirectResponse
    {
        $user = $request->user();
        if (! $user->isAdmin() && $batch->user_id !== $user->id) {
            abort(403, 'Unauthorized.');
        }

        $result = \App\Services\KfintechAllotmentService::checkBatchAllotment($batch);

        if ($request->wantsJson()) {
            return response()->json($result);
        }

        if ($result['success'] && $result['found']) {
            $statusMsg = $result['allotted'] ? 'ALLOTTED' : 'NOT ALLOTTED';
            return back()->with('success', "Allotment status from KFintech: {$statusMsg}. (Name: {$result['name_from_pan']})");
        }

        return back()->with('info', $result['message'] ?? 'No allotment record found on KFintech.');
    }

    public function approve(Request $request, ApplicationBatch $batch): RedirectResponse
    {
        if (! $request->user()->isAdmin()) {
            abort(403, 'Only admins can approve applications.');
        }

        $batch->update(['application_status' => 'confirmed']);
        AuditService::log('batch_approved', $batch, null, ['approved_by' => $request->user()->name]);

        return back()->with('success', "Application {$batch->batch_number} approved successfully.");
    }

    public function approveAll(Request $request, \App\Models\Ipo $ipo): RedirectResponse
    {
        if (! $request->user()->isAdmin()) {
            abort(403, 'Only admins can approve applications.');
        }

        $count = ApplicationBatch::where('ipo_id', $ipo->id)
            ->whereIn('application_status', ['pending_approval', 'submitted'])
            ->update(['application_status' => 'confirmed']);

        AuditService::log('batches_bulk_approved', $ipo, null, [
            'approved_count' => $count,
            'approved_by' => $request->user()->name,
        ], "Approved all {$count} pending application(s) for {$ipo->company_name}");

        return back()->with('success', "Approved all {$count} pending application(s) successfully.");
    }

    public function reject(Request $request, ApplicationBatch $batch): RedirectResponse
    {
        if (! $request->user()->isAdmin()) {
            abort(403, 'Only admins can reject applications.');
        }

        $batch->update(['application_status' => 'cancelled']);
        AuditService::log('batch_rejected', $batch, null, ['rejected_by' => $request->user()->name]);

        return back()->with('success', "Application {$batch->batch_number} rejected.");
    }

    public function updatePan(Request $request, ApplicationBatch $batch): RedirectResponse
    {
        $user = $request->user();
        if (! $user->isAdmin() && $batch->user_id !== $user->id) {
            abort(403, 'Unauthorized.');
        }

        $validated = $request->validate([
            'pan_number' => 'nullable|string|max:10',
            'pan_id' => 'nullable|exists:user_pans,id',
            'applicant_name' => 'nullable|string|max:150',
        ]);

        $panNum = null;
        if (! empty($validated['pan_id'])) {
            $savedPan = UserPan::find($validated['pan_id']);
            if ($savedPan) {
                $panNum = strtoupper($savedPan->pan_number);
                if (empty($validated['applicant_name']) && ! empty($savedPan->account_holder_name)) {
                    $validated['applicant_name'] = $savedPan->account_holder_name;
                }
            }
        } elseif (! empty($validated['pan_number'])) {
            $panNum = strtoupper(trim($validated['pan_number']));
            UserPan::firstOrCreate([
                'user_id' => $batch->user_id,
                'pan_number' => $panNum,
            ], [
                'account_holder_name' => $validated['applicant_name'] ?? $batch->applicant_name ?? 'Applicant',
                'status' => 'active',
            ]);
        }

        if ($panNum) {
            $updateData = ['pan_number' => $panNum];
            if (! empty($validated['applicant_name'])) {
                $updateData['applicant_name'] = $validated['applicant_name'];
            }
            $batch->update($updateData);

            $batchPan = $batch->batchPans()->first();
            if ($batchPan) {
                $batchPan->update([
                    'pan_number_snapshot' => $panNum,
                    'user_pan_id' => $validated['pan_id'] ?? $batchPan->user_pan_id,
                ]);
            } else {
                $batch->batchPans()->create([
                    'user_pan_id' => $validated['pan_id'] ?? null,
                    'pan_number_snapshot' => $panNum,
                    'shares_allotted' => 0,
                    'is_allotted' => false,
                ]);
            }

            AuditService::log('pan_updated', $batch, null, [
                'pan_number' => $panNum,
                'updated_by' => $user->name,
            ]);

            return back()->with('success', "PAN updated to {$panNum} for {$batch->batch_number}.");
        }

        return back()->with('error', 'No valid PAN provided.');
    }
}
