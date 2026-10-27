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

    /**
     * Export User Rates CSV for a specific IPO.
     * Columns: Serial No, Name of PAN Holder, PAN Number, Rate Applied, Allotment Status
     */
    public function exportUserCsv(Request $request, Ipo $ipo): StreamedResponse
    {
        $user = $request->user();
        $targetUserId = $user->isAdmin() ? $request->input('user_id') : $user->id;

        if (in_array(strtolower((string) $request->query('format')), ['excel', 'xlsx'])) {
            return CsvExportService::exportUserExcel($ipo, $targetUserId ? (int) $targetUserId : null);
        }

        return CsvExportService::exportUserCsv($ipo, $targetUserId ? (int) $targetUserId : null);
    }

    /**
     * Export User Rates Excel (.xlsx) for a specific IPO with yellow highlight on allotted rows.
     */
    public function exportUserExcel(Request $request, Ipo $ipo): StreamedResponse
    {
        $user = $request->user();
        $targetUserId = $user->isAdmin() ? $request->input('user_id') : $user->id;

        return CsvExportService::exportUserExcel($ipo, $targetUserId ? (int) $targetUserId : null);
    }

    /**
     * Export Trader Rates CSV for a specific IPO (Admin only).
     * Columns: Serial No, Name of PAN Holder, PAN Number, Trader Rate, Allotment Status
     */
    public function exportTraderCsv(Request $request, Ipo $ipo): StreamedResponse
    {
        $user = $request->user();

        if (! $user->isAdmin()) {
            abort(403, 'Unauthorized. Trader rates CSV is accessible only to administrators.');
        }

        $targetUserId = $request->input('user_id');

        if (in_array(strtolower((string) $request->query('format')), ['excel', 'xlsx'])) {
            return CsvExportService::exportTraderExcel($ipo, $targetUserId ? (int) $targetUserId : null);
        }

        return CsvExportService::exportTraderCsv($ipo, $targetUserId ? (int) $targetUserId : null);
    }

    /**
     * Export Trader Rates Excel (.xlsx) for a specific IPO (Admin only) with yellow highlight on allotted rows.
     */
    public function exportTraderExcel(Request $request, Ipo $ipo): StreamedResponse
    {
        $user = $request->user();

        if (! $user->isAdmin()) {
            abort(403, 'Unauthorized. Trader rates Excel is accessible only to administrators.');
        }

        $targetUserId = $request->input('user_id');

        return CsvExportService::exportTraderExcel($ipo, $targetUserId ? (int) $targetUserId : null);
    }

    /**
     * Export User Rates CSV across all applications (filtered by user if not admin).
     */
    public function exportAllUserCsv(Request $request): StreamedResponse
    {
        $user = $request->user();
        $targetUserId = $user->isAdmin() ? $request->input('user_id') : $user->id;

        if (in_array(strtolower((string) $request->query('format')), ['excel', 'xlsx'])) {
            return CsvExportService::exportUserExcel(null, $targetUserId ? (int) $targetUserId : null);
        }

        return CsvExportService::exportUserCsv(null, $targetUserId ? (int) $targetUserId : null);
    }

    /**
     * Export User Rates Excel (.xlsx) across all applications.
     */
    public function exportAllUserExcel(Request $request): StreamedResponse
    {
        $user = $request->user();
        $targetUserId = $user->isAdmin() ? $request->input('user_id') : $user->id;

        return CsvExportService::exportUserExcel(null, $targetUserId ? (int) $targetUserId : null);
    }

    /**
     * Export Trader Rates CSV across all applications (Admin only).
     */
    public function exportAllTraderCsv(Request $request): StreamedResponse
    {
        $user = $request->user();

        if (! $user->isAdmin()) {
            abort(403, 'Unauthorized. Trader rates CSV is accessible only to administrators.');
        }

        $targetUserId = $request->input('user_id');

        if (in_array(strtolower((string) $request->query('format')), ['excel', 'xlsx'])) {
            return CsvExportService::exportTraderExcel(null, $targetUserId ? (int) $targetUserId : null);
        }

        return CsvExportService::exportTraderCsv(null, $targetUserId ? (int) $targetUserId : null);
    }

    /**
     * Export Trader Rates Excel (.xlsx) across all applications (Admin only).
     */
    public function exportAllTraderExcel(Request $request): StreamedResponse
    {
        $user = $request->user();

        if (! $user->isAdmin()) {
            abort(403, 'Unauthorized. Trader rates Excel is accessible only to administrators.');
        }

        $targetUserId = $request->input('user_id');

        return CsvExportService::exportTraderExcel(null, $targetUserId ? (int) $targetUserId : null);
    }
}
