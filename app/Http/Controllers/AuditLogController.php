<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        $query = AuditLog::with('user');

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('search')) {
            $search = '%'.$request->search.'%';
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', $search)
                    ->orWhere('action', 'like', $search)
                    ->orWhere('ip_address', 'like', $search);
            });
        }

        $logs = $query->orderByDesc('id')->paginate(25)->withQueryString();

        return Inertia::render('audit/index', [
            'logs' => $logs,
            'filters' => $request->only(['action', 'search']),
        ]);
    }
}
