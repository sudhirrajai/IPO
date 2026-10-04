# IPO Management Application — Implementation Tracker & Progress Log

> **Reference:** [`ipo-management-antigravity-prompt.md`](./ipo-management-antigravity-prompt.md)  
> **Status Overview:** ✅ COMPLETED & FULLY VERIFIED  
> **Last Updated:** 2026-10-03  

---

## 1. Project Overview & Architecture Strategy
This project extends the existing Laravel 13 + React 19 + Inertia v3 + Tailwind CSS v4 + Wayfinder starter kit into a complete, production-ready IPO management, PAN registry, rate tracking, and profit settlement web application.

### Key Architectural Decisions
- **Monetary Storage:** Fixed precision decimals/integers for all monetary fields (`trader_rate`, `published_rate`, `margin`, `capital_amount`, `gross_profit`, `user_payout`, `net_earnings`, `settled_amount`) to prevent floating-point calculation errors.
- **Role-Based Access Control:** `role` column on `users` (`admin` vs `user`), enforced by Laravel middleware (`EnsureAdmin`), route guards, and controller-level security checks.
- **PAN Security & Privacy:** Normalized (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`), masked by default (`XXXXXX1234`), full reveal requires authentication and logs audit trails.
- **Rate Immutability:** Strict snapshots at the time of application submission. Changing rates creates new rate versions in `ipo_rates` and never retroactively alters submitted application batches.
- **Provider Abstraction:** `IpoProviderInterface` implemented by `IpoAlertsProvider`, `UpstoxProvider`, and `MockIpoProvider` for flexible multi-source syncing without schema rewrites.
- **Settlement & Funding Engine:** Clear separation between "My Money" (capital deployed + margin/proceeds) and "User Money" (user capital + fixed payout/margin), preventing double-counting of earnings.
- **Robust CSV Engine:** Server-side CSV generation with formula-injection mitigation (`=`, `+`, `-`, `@`, `\t`, `\r`), UTF-8 BOM, custom column mapping for trader submission, and separate financial reports.

---

## 2. Comprehensive Implementation Roadmap

### Phase 1: Codebase Inspection & Baseline Setup
- [x] Inspect existing Laravel 13, React 19, Inertia v3, Wayfinder, Tailwind CSS v4 setup.
- [x] Run baseline tests (`php artisan test`) and verify build (`npm run build`).
- [x] Initialize implementation tracking markdown document (`IPO_IMPLEMENTATION_TRACKER.md`).

---

### Phase 2: Core Domain Schema, Migrations, Models & Roles
- [x] Add `role`, `status`, and `phone` to `users` table migration (`2026_10_03_000001_add_role_and_status_to_users_table.php`).
- [x] Create database migration for `user_pans` (`2026_10_03_000002_create_user_pans_table.php`).
- [x] Create database migration for `ipos` (`2026_10_03_000003_create_ipos_table.php`).
- [x] Create database migration for `ipo_rates` (`2026_10_03_000004_create_ipo_rates_table.php`).
- [x] Create database migration for `application_batches` (`2026_10_03_000005_create_application_batches_table.php`).
- [x] Create database migration for `application_batch_pans` (`2026_10_03_000006_create_application_batch_pans_table.php`).
- [x] Create database migration for `settlements` (`2026_10_03_000007_create_settlements_table.php`).
- [x] Create database migration for `audit_logs` (`2026_10_03_000008_create_audit_logs_table.php`).
- [x] Create database migration for `sync_logs` (`2026_10_03_000009_create_sync_logs_table.php`).
- [x] Create database migration for `app_settings` (`2026_10_03_000010_create_app_settings_table.php`).
- [x] Create Eloquent Models with relationships, casts, and helper methods:
  - [x] `User` (role helpers: `isAdmin()`, `pans()`, `applicationBatches()`, `auditLogs()`)
  - [x] `UserPan` (masked PAN accessor, normalization mutator, scopes)
  - [x] `Ipo` (rates, activeRate, applicationBatches, sync status)
  - [x] `IpoRate` (immutable history, creator)
  - [x] `ApplicationBatch` (user, ipo, panMappings, rate snapshots, settlement)
  - [x] `ApplicationBatchPan` (batch, pan)
  - [x] `Settlement` (batch, creator)
  - [x] `AuditLog` & `SyncLog`
  - [x] `AppSetting`

---

### Phase 3: Authentication, Authorization & User Management
- [x] Implement `EnsureAdmin` middleware and register route alias (`bootstrap/app.php`).
- [x] Update Inertia shared user payload to include `role` and flash messages (`HandleInertiaRequests.php`).
- [x] Admin User Management controller & views (`UserController.php` & `resources/js/pages/users/index.tsx`).

---

### Phase 4: PAN Registry Module
- [x] `PanService` for PAN validation (standard Indian PAN format `[A-Z]{5}[0-9]{4}[A-Z]{1}`), deduplication per user, masking (`XXXXXX1234`), and safe storage.
- [x] `UserPanController`:
  - List saved PANs (user gets only own PANs, admin can manage/view all users' PANs).
  - Store new PAN (manual entry with real-time format validation).
  - Toggle PAN status / deactivate.
  - Reveal full PAN endpoint with authorization check and audit log recording.
- [x] React UI for PAN Registry (`resources/js/pages/pans/index.tsx`):
  - User PAN list with masked display, toggle reveal, copy-to-clipboard.
  - Add PAN modal with real-time format validation.
  - Admin view of all users' PAN records with search, filter, and audit logging.

---

### Phase 5: IPO Management & Provider Synchronization
- [x] Provider Interface: `App\Contracts\IpoProviderInterface`.
- [x] Provider Implementations:
  - `IpoAlertsProvider` (HTTP API adapter with error handling).
  - `UpstoxProvider` (Live Upstox v2 `/v2/ipos` integration adapter with parallel detail enrichment via `Http::pool`).
  - `MockIpoProvider` (High fidelity mock data for sandbox/offline testing & fallback).
- [x] Dynamic Date-Based Status Recalculation Engine:
  - Automatically categorizes IPOs into `open`, `upcoming`, and `closed` based on current bidding window vs system date.
  - Interactive category navigation tabs (`All`, `Open`, `Upcoming`, `Closed`) with real-time counters and pulsating indicators.
  - Removed all hardcoded mock records, dummy users, dummy PANs, and dummy batches for a 100% dynamic database.
- [x] `IpoSyncService`:
  - Fetch from active provider.
  - Idempotent upsert (matching on symbol / provider_id).
  - Preservation of internal configured rates (NEVER overwrite manual rates).
  - Record execution in `sync_logs`.
- [x] `IpoController` & `IpoSyncController`:
  - CRUD for IPOs (manual create, edit, archive).
  - Manual sync trigger endpoint.
  - Sync log history (`resources/js/pages/sync/index.tsx`).
- [x] Scheduled Command: `ipo:sync` for background synchronization (`app/Console/Commands/SyncIposCommand.php`).

---

### Phase 6: Rate Management Engine
- [x] `IpoRateService`:
  - Save new rate pair (`trader_rate`, `published_rate`, computed `margin`).
  - Validation: Ensure published rate does not exceed trader rate without explicit admin flag.
  - Maintain historical rate records with effective timestamps and creator.
- [x] `IpoRateController`:
  - Update rates for an IPO with confirmation and audit note.
  - Fetch rate history for an IPO.
- [x] Frontend rate editing modal with live margin preview and audit history inside IPO Workspace.

---

### Phase 7: Application Batch Management & Financial Engine
- [x] `FinancialCalculationService`:
  - Configured batch margin: `(trader_rate - published_rate) * count`.
  - Funding model calculations:
    - "My Money": Capital deployed by admin = `lot_size * issue_price * count` (or custom capital), Gross proceeds, Net admin earnings.
    - "User Money": User capital, agreed fixed payout, admin margin = `margin * count`.
  - Prevent double counting between margin model and gross profit model.
- [x] `ApplicationBatchService`:
  - Create batch: Snapshot current active rates, link selected PAN(s), calculate estimated financials.
  - Support individual PAN mapping per application in batch.
  - Status lifecycle transitions (Draft -> Submitted -> Confirmed -> Allotted -> Settled -> Cancelled).
- [x] `ApplicationBatchController`:
  - Create, view, update status, cancel batches.
  - Admin rate override per batch if needed (with audit log).
  - User view: Only see their own batches and published rate, NEVER see trader rate or admin margin.
- [x] `SettlementController`:
  - Record actual settlement values: gross profit realized, final user payout, net earnings, capital returned.
  - Record audit log.

---

### Phase 8: CSV Export Engine
- [x] `CsvExportService`:
  - RFC 4180 CSV escaping, UTF-8 with BOM for Excel compatibility.
  - Sanitization of formula injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`).
  - Streamed server-side response.
- [x] Export Types:
  - 1. Trader PAN Submission CSV (`/ipos/{ipo}/export/trader`): Columns: Batch ID, IPO Name, Symbol, Applicant Name, PAN Number, Application Count, Funding Source, Submission Date, Status, Trader Ref, Notes — **STRICTLY EXCLUDES private trader rate and admin margin**.
  - 2. Comprehensive Financial and Batch Report (`/ipos/{ipo}/export/financials`): Complete admin ledger with trader rates, published rates, margins, capital, expected and realized payouts/earnings.
- [x] Audit log on export with exported row count and user ID.

---

### Phase 9: Frontend Interface & Workspaces
- [x] **Navigation & Shell:**
  - Dynamic sidebar in `resources/js/components/app-sidebar.tsx`:
    - Admin: Dashboard, IPO Listings, Applications, PAN Registry, Friends & Users, Provider & Sync, Audit Logs.
    - User: Dashboard, Current IPOs, My Applications, My Saved PANs.
- [x] **Admin Dashboard (`resources/js/pages/dashboard.tsx`):**
  - Metric cards: Expected Net Earnings, Capital Deployed (My Money) vs User Capital, Total Applications, Active Pipeline.
  - Financial health banner with Gross Expected Profit, Agreed User Payouts, Realized Payouts, Pending Settlements.
  - Recent application batches with live margin breakdown.
  - Active IPOs quick view.
- [x] **User Dashboard (`resources/js/pages/user-dashboard.tsx`):**
  - Personal expected payouts, settled payouts, application count, saved PANs count.
  - Available IPOs with user published rates.
  - Recent personal applications.
- [x] **IPO Listing Page (`resources/js/pages/ipos/index.tsx`):**
  - Search and filter by status (open, upcoming, closed) and category (mainboard, sme).
  - Cards with price band, lot size, dates, GMP, and published rate.
  - Manual IPO creation modal for Admin.
- [x] **IPO Workspace Detail Page (`resources/js/pages/ipos/show.tsx`):**
  - **Tab A: Overview** — Metrics, price band, lot size, timeline, provider status.
  - **Tab B: Applications** — Table of batches with applicant, count, PAN reference, rate snapshot, funding source, payout, margin, status, and settlement actions.
  - **Tab C: Rates & History** — Active rate cards, margin calculator, audit trail of historical rates.
  - **Tab D: Funding & Profit** — Side-by-side comparison of "My Money" vs "User Money" capital and net earnings.
  - **Tab E: Exports** — One-click download for Trader PAN Submission CSV and Complete Financials CSV.
- [x] **Applications Index (`resources/js/pages/applications/index.tsx`):**
  - Filterable by IPO, user, funding source, app status, settlement status.
  - Cancellation modal with reason capture.
- [x] **PAN Management (`resources/js/pages/pans/index.tsx`):**
  - Masked cards with toggleable reveal button and clipboard copy.
  - Add PAN modal with validation.
  - Active / Deactivate toggle.
- [x] **User Management (`resources/js/pages/users/index.tsx`):**
  - Friends list, add user modal, edit user modal, role & status controls.
- [x] **Provider Sync Page (`resources/js/pages/sync/index.tsx`):**
  - Provider selector (Mock, IPO Alerts, Upstox), manual sync trigger, sync log history table.
- [x] **Audit Logs Page (`resources/js/pages/audit/index.tsx`):**
  - Filterable timeline of security and financial actions.

---

### Phase 10: Testing, Verification & Seeders
- [x] **Database Seeders (`database/seeders/DatabaseSeeder.php`):**
  - Admin: `admin@ipoapp.local` / `password`
  - Users: `rahul@ipoapp.local` / `password`, `priya@ipoapp.local` / `password`
  - Saved PANs for Rahul and Priya
  - Synced mock IPOs
  - Seeded rate changes and batches demonstrating Scenarios 1, 2, and 6.
- [x] **Feature Test Suite (`tests/Feature/IpoManagementScenariosTest.php`):**
  - `Scenario 1: Rate changes preserve immutable snapshots on application batches` ✅ Passed
  - `Scenario 2: Funding source isolates My Money and User Money without double counting` ✅ Passed
  - `Scenario 3: Saved PAN records are normalized, masked, and unauthorized access is prevented` ✅ Passed
  - `Scenario 4: CSV Export for Trader strictly excludes private rates and margins` ✅ Passed
  - `Scenario 5: Provider synchronization does not overwrite configured internal rates` ✅ Passed
  - `Scenario 6: Settlement tracks expected vs realized earnings and keeps capital separate` ✅ Passed
- [x] **CI Verification:**
  - `vendor/bin/pint --test`: Passed ✅
  - `npm run types:check` (`tsc --noEmit`): Passed with 0 errors ✅
  - `npm run build` (`vp build`): Production bundle built with 0 errors ✅
  - `php artisan test`: 27 passed, 5 skipped, 105 assertions in 2.30s ✅

---

### Recent Fixes & Configuration Updates (2026-10-03):
- **Double AppLayout Nesting Bug Fixed:** Changed Inertia's default layout resolver in `app.tsx` to `null` so pages that explicitly render `<AppLayout breadcrumbs={breadcrumbs}>` are wrapped exactly once, eliminating the blank top bar and duplicate sidebar triggers.
- **Audit Table & Badge High-Contrast UI:** Badges now use subtle background tint (`bg-xxx/10`) and high-contrast text colors (`text-xxx-400` in dark mode) for crisp readability.
- **Signup Feature Removed:** Disabled `Features::registration()` in `config/fortify.php`, removed "Sign up" links from `login.tsx` and `welcome.tsx`, and replaced `register.tsx` with an invitation-only access notice.
- **Provider API Keys Management:** Added live API credential inputs directly on the `/sync` page with password visibility toggles, allowing keys to be set and saved in database settings or in `.env` (`IPO_ALERTS_API_KEY`, `UPSTOX_API_KEY`, `UPSTOX_ACCESS_TOKEN`).
- **Upcoming IPOs & Multi-Status Upstox Fetch:** Parallelized Upstox IPO retrieval across `open`, `upcoming`, and `closed` feeds (fetching 50+ IPOs including Reliance Jio).
- **Direct Application Filling (Rate-Free):** Users can fill IPO applications without requiring pre-configured fixed rates. Supports flexible profit sharing (`Fixed ₹` flat amount or `Percentage %` of listing gain).
- **Bank Account Feature:** Fast bank management where users only need to enter the bank account name (e.g. HDFC Bank, SBI, Kotak). Quick add directly inside application modal.
- **Dynamic IPO & GMP Auto-Calculations:** Total IPO amount (`lot_size * price * count`), GMP snapshot, expected listing gain (`lot_size * GMP * count`), partner payout, and net earnings calculate dynamically from live API data.
- **1-Click Allotment Actions:** Instant `[✓ Allotted]` and `[✗ Not Allotted]` buttons directly on the application table that finalize settlements and release capital in one click.
- **Saved UPI IDs & Bank Account Linking:**
  - Dedicated `user_upis` table linked to user and optionally foreign-keyed to `bank_accounts`.
  - Supports adding UPI IDs inside a specific bank account or as standalone UPI IDs.
  - Automatic detection of UPI app from VPA handle (`Google Pay` for `@okhdfcbank`, `@okaxis`, `@oksbi`, `@okicici`; `PhonePe` for `@ybl`, `@ibl`, `@axl`; `Paytm` for `@ptsbi`, `@paytm`; `BHIM` for `@upi`; `Cred` for `@cred`; `Amazon Pay` for `@apl`, `@rapl`), with manual override.
  - Quick saved UPI dropdown in Application Form: selecting a UPI ID automatically fills and links the corresponding bank account!
  - Bank account cards display linked UPI badges with an inline "+ Add UPI" tool.
  - Styled UPI App badges displayed in application tables across both IPO detail view and `/applications` view.
- **Grey Market Premium (GMP) Live Updating & Investigation:**
  - Diagnosed Upstox API response: Verified that official SEBI-regulated brokers (Upstox/NSE/BSE) do not publish unofficial grey market rates under SEBI guidelines.
  - Added dedicated endpoint `POST /ipos/{ipo}/gmp` to set or update GMP at any time.
  - Interactive **"+ Set GMP" / "Edit"** button added directly on the Grey Market Premium card on the IPO page.
  - Dynamic percentage premium calculation (e.g. `+₹25 (+33.3%)`) and instant real-time profit & listing gain recalculation.
  - Protected manual GMP inputs from being erased during subsequent provider syncs.
- **Global Page Loader & Error Notification System:**
  - Added responsive top progress bar (`emerald-500` to `blue-500` glowing gradient) for all Inertia page transitions and form submissions.
  - Added floating status pill (`Loading...` with spinner) for visual responsiveness during background processing.
  - Immediately exits the loader and renders a dismissible alert banner on the page if an error occurs.
- **User-Friendly Low-Scroll Bento Redesign (`/ipos/{id}`):**
  - **Above the Fold 4-KPI Grid:** Price band & 1-lot minimum investment, Grey Market Premium (GMP) with dynamic `%` gain and live edit button, demand/subscription status (`0.68x`), and bidding date window.
  - **Horizontal Milestone Timeline Stepper:** 4-step milestone stepper (Bidding window ➔ Allotment ➔ Refund/Mandate Unblock ➔ Exchange Listing Day) with daily cutoff hours.
  - **Dense 2-Column Bento Layout (Eliminates Vertical Stacking):**
    - *Left (60%):* Compact specification table (Price band, lot size, min investment, total issue size, face value, bidding hours, mandate expiry, ISIN with 1-click copy).
    - *Right (40%):*
      - *Interactive Lot & Profit Estimator:* 1-click pills (`1 Lot`, `2 Lots`, `5 Lots`, `10 Lots`), capital calculation, estimated listing gain, fixed rate payout, and instant "Apply with X Lots" action button.
      - *Registrar & Filings Card:* Official RTA name, contact phone/email, and direct links to DRHP Prospectus / RHP Filings.
  - **Unconditional Application Filling:** Enabled "Record Application" button regardless of whether fixed rate has been published.
- **InvestorGain Live GMP Automated Background Scraper & 30-Min Cron:**
  - Integrated scraping engine (`App\Services\GmpScraperService`) for `https://www.investorgain.com/report/ipo-gmp-live/331/`.
  - Automatically identifies **Mainboard** vs **SME** issues, parses current GMP values, gain percentages, and overall subscription rates (`1.71x`).
  - Resilient normalized multi-pass matching algorithm (exact clean string, containment, and fuzzy similarity > 80%).
  - Automatically enriches matched database IPOs with live GMP, subscription, and metadata source tags.
  - Configured 30-minute background cron in `routes/console.php`: `Schedule::command('ipo:scrape-gmp')->everyThirtyMinutes()->withoutOverlapping()->runInBackground();`.
  - Provided CLI command `php artisan ipo:scrape-gmp` with `--dry-run` inspection flag.
  - Added dedicated **InvestorGain Live GMP Scraper** card on `/sync` with instant 1-click **"Scrape Live GMP Now"** trigger, execution metrics, and timestamp tracking.
  - Verified with comprehensive test suite (`tests/Feature/GmpScraperServiceTest.php`): 4 passed, 22 assertions.
- **KFintech Live Allotment Scraper & Modal, Delete Application, Admin PAN Unmasking, and Fix Application Controls (2026-10-04):**
  - **KFintech Allotment Gateway Integration:**
    - Reverse-engineered KFintech's live portal (`https://ipostatus.kfintech.com/`) and AWS API Gateway endpoint (`https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan`).
    - Implemented `App\Services\KfintechAllotmentService` with dynamic IPO matching across KFintech's 90+ active registrar listings.
    - Compares `App_Shares` vs `All_Shares`: if allotted shares > 0, marks application as `allotted` and settles payout/profit; if 0, marks as `not_allotted` and records refunded capital.
    - Extracts investor's verified legal name from the PAN (e.g. `SUDHIR NARENDRAKUMAR RAJAI`) and updates `applicant_name` on both batch and `user_pans`.
    - Created reusable [`KfintechAllotmentModal`](file:///d:/Projects/ipo-app/resources/js/components/kfintech-allotment-modal.tsx) matching KFintech's official UI: Application No, Investor Name from PAN, DP ID / Client ID, PAN number, Applied shares, Allotted shares, and status badge with 1-click re-check.
    - Automated hourly background cron: `Schedule::command('ipo:check-allotment')->hourly()->withoutOverlapping()->runInBackground()` in `routes/console.php`.
    - Added "Check Allotment" button on each application row with a PAN, plus a header button "Check All KFintech" on the IPO page.
  - **Delete Application Feature:**
    - Added `destroy` endpoint in `ApplicationBatchController` with policy authorization (admin can delete any application; regular users can delete their own non-settled applications).
    - Added Delete icon button (`Trash2`) on both `/applications` and `/ipos/{id}` application tables with confirmation dialog and cascade cleanup of linked PAN records.
  - **Admin PAN Unmasking & 1-Click Copy:**
    - Unmasked full PAN numbers (e.g. `ABCDE1234F`) for administrators in all tables and modals, accompanied by a 1-click copy-to-clipboard button with visual feedback.
    - Non-admin users continue to see secure masked PANs (`XXXXXX1234`).
  - **Accept Fix Applications Admin Toggle:**
    - Added `accept_fix_applications` boolean column on `ipos` (default `true`).
    - Added 1-click toggle button (`Fix Apps: ON / OFF`) in the IPO header for administrators.
    - When disabled, non-admin users cannot submit applications under the Fixed rate model; the button in the application modal displays `Closed` and disables selection.
  - **Auto-Approve Fix Applications Feature:**
    - Added `auto_approve_fix` boolean column on `ipos` (default `true`).
    - Added toggle button (`Auto-Approve: ON / OFF`) in the IPO header for administrators.
    - When disabled, user applications under fixed rates enter `pending_approval` status rather than `confirmed`.
    - Admin is presented with `[✓ Approve]` and `[✗ Reject]` action buttons directly on the application rows.




