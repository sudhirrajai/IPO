<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserPan;
use App\Services\AuditService;
use App\Services\PanService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserPanController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();

        $query = UserPan::with('user');

        if (! $isAdmin) {
            $query->where('user_id', $user->id);
        } elseif ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('search')) {
            $search = '%'.$request->search.'%';
            $query->where(function ($q) use ($search) {
                $q->where('account_holder_name', 'like', $search)
                    ->orWhere('pan_number', 'like', $search)
                    ->orWhere('broker_name', 'like', $search);
            });
        }

        $perPageInput = $request->input('per_page', 25);
        $perPage = ($perPageInput === 'all' || (int) $perPageInput >= 500) ? 500 : max(10, min(200, (int) $perPageInput));

        $pans = $query->orderByDesc('id')->paginate($perPage)->withQueryString();
        $users = $isAdmin ? User::select(['id', 'name', 'email'])->orderBy('name')->get() : [];

        return Inertia::render('pans/index', [
            'pans' => $pans,
            'users' => $users,
            'filters' => $request->only(['user_id', 'search', 'per_page']),
            'isAdmin' => $isAdmin,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();

        $targetUserId = ($isAdmin && $request->filled('user_id'))
            ? (int) $request->user_id
            : $user->id;

        $validated = $request->validate([
            'pan_number' => 'required|string|size:10',
            'account_holder_name' => 'nullable|string|max:255',
            'broker_name' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        try {
            $pan = PanService::createPanForUser($targetUserId, $validated);

            // If an account_holder_name is provided, sync any existing batches with this pan_number
            if (! empty($validated['account_holder_name'])) {
                $batches = \App\Models\ApplicationBatch::where('pan_number', $pan->pan_number)->get();
                foreach ($batches as $b) {
                    if (empty($b->applicant_name) || $b->applicant_name === 'Applicant') {
                        $b->update(['applicant_name' => $validated['account_holder_name']]);
                    }
                    if (! $b->batchPans()->where('user_pan_id', $pan->id)->exists()) {
                        $b->batchPans()->create([
                            'user_pan_id' => $pan->id,
                            'sequence_number' => 1,
                            'pan_number_snapshot' => $pan->pan_number,
                            'allotment_status' => 'pending',
                            'allotted_shares' => 0,
                        ]);
                    }
                }
            }

            return back()->with('success', "PAN {$pan->masked_pan} saved successfully.");
        } catch (Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Reveal full unmasked PAN with strict authorization check and audit log.
     */
    public function reveal(Request $request, UserPan $pan): JsonResponse
    {
        $user = $request->user();

        // Server-side authorization check: must be owner or admin
        if (! $user->isAdmin() && $pan->user_id !== $user->id) {
            abort(403, 'Unauthorized. You can only view your own PAN records.');
        }

        AuditService::log(
            'pan_revealed',
            $pan,
            null,
            ['pan_id' => $pan->id, 'owner_user_id' => $pan->user_id],
            "User {$user->name} revealed unmasked PAN for record ID {$pan->id}"
        );

        return response()->json([
            'id' => $pan->id,
            'pan_number' => $pan->pan_number,
            'account_holder_name' => $pan->account_holder_name,
        ]);
    }

    /**
     * Update saved PAN record.
     */
    public function update(Request $request, UserPan $pan): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isAdmin() && $pan->user_id !== $user->id) {
            abort(403, 'Unauthorized. You can only update your own PAN records.');
        }

        $validated = $request->validate([
            'pan_number' => ['required', 'string', 'size:10', 'regex:'.PanService::PAN_REGEX],
            'account_holder_name' => 'nullable|string|max:255',
            'broker_name' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
            'status' => 'required|in:active,inactive',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $normalizedPan = PanService::normalize($validated['pan_number']);
        $targetUserId = ($user->isAdmin() && $request->filled('user_id'))
            ? (int) $request->user_id
            : $pan->user_id;

        $duplicate = UserPan::where('user_id', $targetUserId)
            ->where('pan_number', $normalizedPan)
            ->where('id', '!=', $pan->id)
            ->exists();

        if ($duplicate) {
            return back()->with('error', 'This PAN is already registered under this account.');
        }

        $old = $pan->toArray();
        $pan->update([
            'user_id' => $targetUserId,
            'pan_number' => $normalizedPan,
            'account_holder_name' => $validated['account_holder_name'] ?? null,
            'broker_name' => $validated['broker_name'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => $validated['status'],
        ]);

        $newHolderName = $validated['account_holder_name'] ?? null;
        $oldPanNumber = $old['pan_number'] ?? null;

        // Synchronize all application batches linked to this PAN
        $batchIds = \App\Models\ApplicationBatchPan::where('user_pan_id', $pan->id)->pluck('application_batch_id');

        $batchQuery = \App\Models\ApplicationBatch::where(function ($q) use ($batchIds, $normalizedPan, $oldPanNumber) {
            if ($batchIds->isNotEmpty()) {
                $q->whereIn('id', $batchIds);
            }
            $q->orWhere('pan_number', $normalizedPan);
            if (! empty($oldPanNumber)) {
                $q->orWhere('pan_number', $oldPanNumber);
            }
        });

        $batchUpdateData = ['pan_number' => $normalizedPan];
        if (! empty($newHolderName)) {
            $batchUpdateData['applicant_name'] = $newHolderName;
        }

        $matchingBatches = $batchQuery->get();
        foreach ($matchingBatches as $matchingBatch) {
            $matchingBatch->update($batchUpdateData);

            // Ensure ApplicationBatchPan is synced/linked
            $batchPan = $matchingBatch->batchPans()->where('user_pan_id', $pan->id)->first();
            if ($batchPan) {
                $batchPan->update(['pan_number_snapshot' => $normalizedPan]);
            } else {
                $firstBatchPan = $matchingBatch->batchPans()->first();
                if ($firstBatchPan) {
                    $firstBatchPan->update([
                        'user_pan_id' => $pan->id,
                        'pan_number_snapshot' => $normalizedPan,
                    ]);
                } else {
                    $matchingBatch->batchPans()->create([
                        'user_pan_id' => $pan->id,
                        'sequence_number' => 1,
                        'pan_number_snapshot' => $normalizedPan,
                        'allotment_status' => 'pending',
                        'allotted_shares' => 0,
                    ]);
                }
            }
        }

        AuditService::log(
            'pan_updated',
            $pan,
            $old,
            $pan->toArray(),
            "User {$user->name} updated PAN record {$pan->masked_pan}"
        );

        return back()->with('success', "PAN {$pan->masked_pan} updated successfully.");
    }

    /**
     * Toggle PAN active/inactive status.
     */
    public function toggle(Request $request, UserPan $pan): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isAdmin() && $pan->user_id !== $user->id) {
            abort(403, 'Unauthorized.');
        }

        $newStatus = $pan->status === 'active' ? 'inactive' : 'active';
        $old = $pan->toArray();
        $pan->update(['status' => $newStatus]);

        AuditService::log(
            'pan_status_changed',
            $pan,
            ['status' => $old['status'] ?? 'unknown'],
            ['status' => $newStatus],
            "PAN {$pan->masked_pan} status set to {$newStatus}"
        );

        return back()->with('success', "PAN {$pan->masked_pan} status updated to {$newStatus}.");
    }

    /**
     * Delete PAN record with safe soft-delete preserving historical applications.
     */
    public function destroy(Request $request, UserPan $pan): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isAdmin() && $pan->user_id !== $user->id) {
            abort(403, 'Unauthorized.');
        }

        $masked = $pan->masked_pan;
        $pan->delete(); // Soft-delete

        AuditService::log(
            'pan_deleted',
            $pan,
            null,
            ['pan_id' => $pan->id, 'masked_pan' => $masked],
            "User {$user->name} deleted PAN {$masked}. Historical application batches remain preserved."
        );

        return back()->with('success', "PAN {$masked} deleted successfully. Historical IPO applications remain safe.");
    }
}

