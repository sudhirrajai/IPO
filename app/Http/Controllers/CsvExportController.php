<?php

namespace App\Http\Controllers;

use App\Models\Ipo;
use App\Services\CsvExportService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CsvExportController extends Controller
{
    public function exportTraderPanSubmission(Request $request, Ipo $ipo): StreamedResponse
    {
        $user = $request->user();
        $targetUserId = $user->isAdmin() ? $request->input('user_id') : $user->id;

        return CsvExportService::exportTraderPanSubmission($ipo, $targetUserId ? (int) $targetUserId : null);
    }

    public function exportFinancialReport(Request $request, Ipo $ipo): StreamedResponse
    {
        $user = $request->user();

        if (! $user->isAdmin()) {
            abort(403, 'Unauthorized. Financial reports are accessible only to administrators.');
        }

        return CsvExportService::exportFinancialReport($ipo);
    }
}
