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

        $pans = $query->orderByDesc('id')->paginate(15)->withQueryString();
        $users = $isAdmin ? User::select(['id', 'name', 'email'])->orderBy('name')->get() : [];

        return Inertia::render('pans/index', [
            'pans' => $pans,
            'users' => $users,
            'filters' => $request->only(['user_id', 'search']),
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

    public function destroy(Request $request, UserPan $pan): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isAdmin() && $pan->user_id !== $user->id) {
            abort(403, 'Unauthorized.');
        }

        $newStatus = $pan->status === 'active' ? 'inactive' : 'active';
        $pan->update(['status' => $newStatus]);

        AuditService::log('pan_status_changed', $pan, ['status' => $pan->getOriginal('status')], ['status' => $newStatus], "PAN {$pan->masked_pan} status set to {$newStatus}");

        return back()->with('success', "PAN status updated to {$newStatus}.");
    }
}
