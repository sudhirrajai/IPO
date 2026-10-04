<?php

namespace App\Http\Controllers;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\IpoRate;
use App\Models\User;
use App\Models\UserPan;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        // Automatically ensure dynamic status alignment with current date
        Ipo::recalculateStatuses();

        $user = $request->user();

        if ($user->isAdmin()) {
            return $this->adminDashboard($request);
        }

        return $this->userDashboard($request, $user);
    }

    protected function adminDashboard(Request $request): Response
    {
        $user = $request->user();

        // 1. User metrics
        $totalUsers = User::count();
        $activeUsers = User::where('status', 'active')->count();

        // 2. IPO metrics
        $totalIpos = Ipo::count();
        $openIpos = Ipo::open()->count();
        $upcomingIpos = Ipo::upcoming()->count();
        $closedIpos = Ipo::closed()->count();

        // 3. Application Batches metrics
        $totalApplications = (int) ApplicationBatch::sum('application_count');
        $myMoneyApps = (int) ApplicationBatch::where('funding_source', 'my_money')->sum('application_count');
        $userMoneyApps = (int) ApplicationBatch::where('funding_source', 'user_money')->sum('application_count');

        // Capital
        $capitalDeployedByMe = (float) ApplicationBatch::where('funding_source', 'my_money')->sum('capital_amount');
        $userFundedCapital = (float) ApplicationBatch::where('funding_source', 'user_money')->sum('capital_amount');

        // Expected Financials
        $expectedGrossProfit = (float) ApplicationBatch::sum('expected_gross_profit');
        $expectedUserPayouts = (float) ApplicationBatch::sum('expected_user_payout');
        $expectedNetEarnings = (float) ApplicationBatch::sum('expected_net_earnings');

        // Realized Financials (From settled batches)
        $realizedGrossProfit = (float) ApplicationBatch::where('settlement_status', 'settled')->sum('settled_gross_profit');
        $realizedUserPayouts = (float) ApplicationBatch::where('settlement_status', 'settled')->sum('settled_user_payout');
        $realizedNetEarnings = (float) ApplicationBatch::where('settlement_status', 'settled')->sum('settled_net_earnings');
        $pendingSettlementsCount = ApplicationBatch::where('settlement_status', '!=', 'settled')
            ->where('application_status', '!=', 'cancelled')
            ->count();

        // Recent items
        $recentBatches = ApplicationBatch::with(['ipo', 'user'])
            ->orderByDesc('id')
            ->limit(8)
            ->get();

        $recentRateChanges = IpoRate::with(['ipo', 'creator'])
            ->orderByDesc('id')
            ->limit(5)
            ->get();

        $openIposList = Ipo::with('activeRate')
            ->open()
            ->orderBy('close_date')
            ->limit(8)
            ->get();

        $upcomingIposList = Ipo::with('activeRate')
            ->upcoming()
            ->orderBy('open_date')
            ->limit(8)
            ->get();

        $closedIposList = Ipo::with('activeRate')
            ->closed()
            ->orderByDesc('close_date')
            ->limit(8)
            ->get();

        // Chart Data: Applications per IPO
        $iposWithApps = Ipo::has('applicationBatches')
            ->withCount(['applicationBatches as total_apps' => function ($query) {
                $query->selectRaw('COALESCE(SUM(application_count), 0)');
            }])
            ->orderByDesc('total_apps')
            ->limit(6)
            ->get()
            ->map(fn ($ipo) => [
                'name' => $ipo->symbol ?: substr($ipo->company_name, 0, 15),
                'applications' => (int) $ipo->total_apps,
            ]);

        $favoriteIposList = $user->favoriteIpos()
            ->with('activeRate')
            ->orderBy('open_date')
            ->get();

        return Inertia::render('dashboard', [
            'metrics' => [
                'totalUsers' => $totalUsers,
                'activeUsers' => $activeUsers,
                'totalIpos' => $totalIpos,
                'openIpos' => $openIpos,
                'upcomingIpos' => $upcomingIpos,
                'closedIpos' => $closedIpos,
                'totalApplications' => $totalApplications,
                'myMoneyApps' => $myMoneyApps,
                'userMoneyApps' => $userMoneyApps,
                'capitalDeployedByMe' => $capitalDeployedByMe,
                'userFundedCapital' => $userFundedCapital,
                'expectedGrossProfit' => $expectedGrossProfit,
                'expectedUserPayouts' => $expectedUserPayouts,
                'expectedNetEarnings' => $expectedNetEarnings,
                'realizedGrossProfit' => $realizedGrossProfit,
                'realizedUserPayouts' => $realizedUserPayouts,
                'realizedNetEarnings' => $realizedNetEarnings,
                'pendingSettlementsCount' => $pendingSettlementsCount,
            ],
            'recentBatches' => $recentBatches,
            'recentRateChanges' => $recentRateChanges,
            'categorizedIpos' => [
                'favorites' => $favoriteIposList,
                'open' => $openIposList,
                'upcoming' => $upcomingIposList,
                'closed' => $closedIposList,
            ],
            'upcomingIpos' => $openIposList->concat($upcomingIposList)->take(8),
            'chartData' => [
                'iposWithApps' => $iposWithApps,
                'fundingSplit' => [
                    ['name' => 'My Money', 'value' => $myMoneyApps],
                    ['name' => 'User Money', 'value' => $userMoneyApps],
                ],
            ],
        ]);

    }

    protected function userDashboard(Request $request, User $user): Response
    {
        // User's own metrics
        $applicationCount = (int) ApplicationBatch::where('user_id', $user->id)->sum('application_count');
        $savedPanCount = UserPan::where('user_id', $user->id)->count();

        $expectedPayout = (float) ApplicationBatch::where('user_id', $user->id)->sum('expected_user_payout');
        $settledPayout = (float) ApplicationBatch::where('user_id', $user->id)
            ->where('settlement_status', 'settled')
            ->sum('settled_user_payout');

        $recentBatches = ApplicationBatch::with('ipo')
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(10)
            ->get();
        $recentBatches->makeHidden([
            'expected_net_earnings',
            'settled_net_earnings',
            'expected_gross_profit',
            'settled_gross_profit',
            'trader_rate_snapshot',
            'margin_snapshot',
        ]);

        $openIpos = Ipo::with('activeRate')
            ->open()
            ->orderBy('close_date')
            ->get();
        $openIpos->each(fn ($i) => $i->activeRate?->makeHidden(['trader_rate', 'margin']));

        $upcomingIpos = Ipo::with('activeRate')
            ->upcoming()
            ->orderBy('open_date')
            ->get();
        $upcomingIpos->each(fn ($i) => $i->activeRate?->makeHidden(['trader_rate', 'margin']));

        $closedIpos = Ipo::with('activeRate')
            ->closed()
            ->orderByDesc('close_date')
            ->limit(10)
            ->get();
        $closedIpos->each(fn ($i) => $i->activeRate?->makeHidden(['trader_rate', 'margin']));

        $favoriteIpos = $user->favoriteIpos()
            ->with('activeRate')
            ->orderBy('open_date')
            ->get();
        $favoriteIpos->each(fn ($i) => $i->activeRate?->makeHidden(['trader_rate', 'margin']));

        return Inertia::render('user-dashboard', [
            'metrics' => [
                'applicationCount' => $applicationCount,
                'savedPanCount' => $savedPanCount,
                'expectedPayout' => $expectedPayout,
                'settledPayout' => $settledPayout,
            ],
            'recentBatches' => $recentBatches,
            'openIpos' => $openIpos,
            'categorizedIpos' => [
                'favorites' => $favoriteIpos,
                'open' => $openIpos,
                'upcoming' => $upcomingIpos,
                'closed' => $closedIpos,
            ],
        ]);
    }
}

