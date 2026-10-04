<?php

use App\Http\Controllers\ApplicationBatchController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\CsvExportController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\IpoController;
use App\Http\Controllers\IpoRateController;
use App\Http\Controllers\IpoSyncController;
use App\Http\Controllers\SettlementController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\UserPanController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('dashboard');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    // Dashboard (Admin or User view routed in controller)
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // IPO Listing & Workspace
    Route::get('/ipos', [IpoController::class, 'index'])->name('ipos.index');
    Route::get('/ipos/{ipo}', [IpoController::class, 'show'])->name('ipos.show');
    Route::post('/ipos/{ipo}/gmp', [IpoController::class, 'updateGmp'])->name('ipos.gmp');

    // Applications
    Route::get('/applications', [ApplicationBatchController::class, 'index'])->name('applications.index');
    Route::post('/applications', [ApplicationBatchController::class, 'store'])->name('applications.store');
    Route::post('/applications/{batch}/cancel', [ApplicationBatchController::class, 'cancel'])->name('applications.cancel');
    Route::delete('/applications/{batch}', [ApplicationBatchController::class, 'destroy'])->name('applications.destroy');
    Route::match(['get', 'post'], '/applications/{batch}/check-allotment', [ApplicationBatchController::class, 'checkAllotment'])->name('applications.check-allotment');
    Route::post('/applications/{batch}/pan', [ApplicationBatchController::class, 'updatePan'])->name('applications.pan');
    Route::post('/applications/{batch}/approve', [ApplicationBatchController::class, 'approve'])->name('applications.approve');
    Route::post('/applications/{batch}/reject', [ApplicationBatchController::class, 'reject'])->name('applications.reject');

    // PAN Registry
    Route::get('/pans', [UserPanController::class, 'index'])->name('pans.index');
    Route::post('/pans', [UserPanController::class, 'store'])->name('pans.store');
    Route::post('/pans/{pan}/reveal', [UserPanController::class, 'reveal'])->name('pans.reveal');
    Route::post('/pans/{pan}/toggle', [UserPanController::class, 'destroy'])->name('pans.toggle');

    // Bank Accounts (Quick Add / Manage)
    Route::post('/bank-accounts', [\App\Http\Controllers\BankAccountController::class, 'store'])->name('bank-accounts.store');
    Route::delete('/bank-accounts/{bankAccount}', [\App\Http\Controllers\BankAccountController::class, 'destroy'])->name('bank-accounts.destroy');

    // UPI IDs (Save, Link to Bank, Delete)
    Route::post('/user-upis', [\App\Http\Controllers\UserUpiController::class, 'store'])->name('user-upis.store');
    Route::put('/user-upis/{userUpi}', [\App\Http\Controllers\UserUpiController::class, 'update'])->name('user-upis.update');
    Route::delete('/user-upis/{userUpi}', [\App\Http\Controllers\UserUpiController::class, 'destroy'])->name('user-upis.destroy');

    // Application Status (Users can update their own, Admins can update any)
    Route::post('/applications/{batch}/status', [ApplicationBatchController::class, 'updateStatus'])->name('applications.status');

    // CSV Exports (Trader PAN export allowed for authorized users)
    Route::get('/ipos/{ipo}/export/trader', [CsvExportController::class, 'exportTraderPanSubmission'])->name('ipos.export.trader');

    // Admin-Only Routes
    Route::middleware(['admin'])->group(function () {
        // IPO CRUD
        Route::post('/ipos', [IpoController::class, 'store'])->name('ipos.store');
        Route::put('/ipos/{ipo}', [IpoController::class, 'update'])->name('ipos.update');
        Route::delete('/ipos/{ipo}', [IpoController::class, 'destroy'])->name('ipos.destroy');
        Route::post('/ipos/{ipo}/toggle-fix', [IpoController::class, 'toggleFixApplications'])->name('ipos.toggle-fix');
        Route::post('/ipos/{ipo}/toggle-auto-approve-fix', [IpoController::class, 'toggleAutoApproveFix'])->name('ipos.toggle-auto-approve-fix');
        Route::post('/ipos/{ipo}/check-allotments', [IpoController::class, 'checkAllotments'])->name('ipos.check-allotments');

        // Rates
        Route::post('/ipos/{ipo}/rates', [IpoRateController::class, 'store'])->name('ipos.rates.store');

        // Application Settlements
        Route::post('/applications/{batch}/settle', [SettlementController::class, 'store'])->name('applications.settle');

        // Financial CSV Export
        Route::get('/ipos/{ipo}/export/financials', [CsvExportController::class, 'exportFinancialReport'])->name('ipos.export.financials');

        // Synchronization
        Route::get('/sync', [IpoSyncController::class, 'index'])->name('sync.index');
        Route::post('/sync/run', [IpoSyncController::class, 'sync'])->name('sync.run');
        Route::post('/sync/gmp', [IpoSyncController::class, 'scrapeGmp'])->name('sync.gmp');
        Route::post('/sync/settings', [IpoSyncController::class, 'updateSettings'])->name('sync.settings');

        // User Management
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');

        // Audit Logs
        Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit.index');
    });
});

require __DIR__.'/settings.php';
