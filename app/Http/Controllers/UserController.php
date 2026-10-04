<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $query = User::withCount(['pans', 'applicationBatches']);

        if ($request->filled('search')) {
            $search = '%'.$request->search.'%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', $search)
                    ->orWhere('email', 'like', $search)
                    ->orWhere('phone', 'like', $search);
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->status === 'archived') {
            $query->onlyTrashed();
        } elseif ($request->status === 'all') {
            $query->withTrashed();
        } elseif ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $users = $query->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('users/index', [
            'users' => $users,
            'filters' => $request->only(['search', 'role', 'status']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'role' => 'required|in:admin,user',
            'phone' => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'status' => 'active',
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($validated['password']),
        ]);

        AuditService::log('user_created', $user, null, [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ], "Created user account for {$user->name}");

        return back()->with('success', "User account for {$user->name} created successfully.");
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'role' => 'required|in:admin,user',
            'status' => 'required|in:active,inactive,archived',
            'phone' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:8',
        ]);

        $updateData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'status' => $validated['status'],
            'phone' => $validated['phone'] ?? null,
        ];

        if (! empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $old = $user->toArray();
        $user->update($updateData);

        AuditService::log('user_updated', $user, $old, $updateData, "Updated user account for {$user->name}");

        return back()->with('success', "User {$user->name} updated successfully.");
    }

    /**
     * Quick toggle user status between active and inactive.
     */
    public function toggleStatus(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'You cannot deactivate your own administrative account.');
        }

        $newStatus = $user->status === 'active' ? 'inactive' : 'active';
        $old = $user->toArray();
        $user->update(['status' => $newStatus]);

        AuditService::log(
            'user_status_toggled',
            $user,
            $old,
            ['status' => $newStatus],
            "Changed account status of {$user->name} to {$newStatus}"
        );

        return back()->with('success', "User {$user->name} is now {$newStatus}.");
    }

    /**
     * Delete user with safe archive option to preserve historical applications and financials.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'You cannot delete your own administrative account.');
        }

        $keepDataSafe = $request->boolean('keep_data_safe', true);

        if ($keepDataSafe) {
            $user->update(['status' => 'archived']);
            $user->delete(); // Soft-delete

            AuditService::log(
                'user_archived',
                $user,
                null,
                ['user_id' => $user->id, 'name' => $user->name, 'keep_data_safe' => true],
                "Safely archived and soft-deleted user {$user->name}. All historical applications and records are preserved."
            );

            return back()->with('success', "User {$user->name} deleted. Historical applications, PAN records, and financial settlements are preserved safely.");
        }

        // Permanent deletion validation: check if user has application batches
        $batchesCount = $user->applicationBatches()->count();
        if ($batchesCount > 0) {
            return back()->with('error', "Cannot permanently wipe {$user->name} because they have {$batchesCount} historical IPO application batches. Please select 'Keep Data Safe' to archive them without losing financial records.");
        }

        $name = $user->name;
        $id = $user->id;

        $user->pans()->forceDelete();
        $user->forceDelete();

        AuditService::log(
            'user_permanently_deleted',
            null,
            null,
            ['user_id' => $id, 'name' => $name],
            "Permanently deleted user {$name} and their records."
        );

        return back()->with('success', "User {$name} was permanently removed.");
    }

    /**
     * Restore an archived/soft-deleted user account.
     */
    public function restore(Request $request, int $id): RedirectResponse
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();
        $user->update(['status' => 'active']);

        AuditService::log(
            'user_restored',
            $user,
            null,
            ['user_id' => $user->id, 'status' => 'active'],
            "Restored user {$user->name} and reactivated account."
        );

        return back()->with('success', "User {$user->name} has been restored and activated successfully.");
    }
}

