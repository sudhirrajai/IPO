# Build a Complete IPO Management, PAN Registry & Profit Tracking Web Application

## 1. Project Context

I have already created a Laravel 13 application with React.js and basic
user authentication. I want you to build a complete, production-quality
IPO management application inside my existing project.

**Important:** Inspect the existing repository before making changes.
Understand the current Laravel and React setup, authentication
implementation, database configuration, routing, frontend components,
styling, and installed packages. Reuse what is already working. Do not
recreate the project, replace authentication unnecessarily, or create a
separate demo application.

This is a private application for my personal use and a small group of
invited friends.

The application will allow me to: - Fetch and manage IPO information. -
Maintain my friends' profiles and PAN records. - Configure IPO-wise
rates offered to users. - Record multiple application batches at
different rates. - Track whether applications are funded by me or by
users. - Track the rate received from an external trader and my
margin. - Calculate expected profits, user payouts, and my earnings. -
Export application data and PAN details to CSV for each IPO. - Maintain
an accurate historical record of all transactions and rate changes.

Build a fully functional application, not just a UI prototype. All
buttons, forms, tables, filters, calculations, API integrations,
exports, and CRUD operations must work.

------------------------------------------------------------------------

## 2. Technology Stack and Architecture

Use the existing stack wherever possible.

-   Backend: Laravel 13.
-   Frontend: React.js with the project's existing integration.
-   Database: Use the database already configured in the project,
    preferably MySQL if that is what the application currently uses.
-   Styling: Reuse the existing Tailwind CSS setup and installed UI
    components.
-   Authentication: Preserve the existing authentication system.
-   API: Use Laravel backend endpoints for all protected operations and
    external API communication.
-   Validation: Laravel Form Requests and appropriate React-side
    validation.
-   Database: Migrations, foreign keys, indexes, transactions, and
    appropriate decimal or integer monetary fields.
-   Authorization: Laravel policies, middleware, and role-based
    permissions.
-   Background processing: Laravel queues and scheduled tasks where
    useful and compatible with the existing setup.
-   Testing: Laravel feature tests and appropriate frontend tests.

Use a clean, maintainable architecture with controllers, services,
models, policies, form requests, jobs, and reusable React components as
appropriate.

Do not expose external API keys or sensitive data to the frontend.

------------------------------------------------------------------------

## 3. User Roles and Access Control

Implement two roles initially.

### Admin --- Me

The admin must be able to: - View and manage all users. - Create, edit,
activate, deactivate, and archive user accounts. - View all IPOs and all
users' applications. - Manage IPO data and rate configurations. -
Maintain trader rates and margins. - View funding sources and profit
reports. - View and manage PAN records with appropriate security
controls. - Export IPO-wise application data to CSV. - Import
application records from CSV if practical. - Review activity logs and
rate-change history. - Configure application settings and data
providers.

### User --- My Friends

Regular users should have their own dashboard and should only be able to
access their own permitted information.

They should be able to: - View IPOs and their published rates. - View
their own application history and application counts. - View the rates
applicable to their application batches. - Manage their own saved PAN
records. - Add a PAN manually or select an existing saved PAN. - View
their own payout information if enabled by the admin. - See the relevant
IPO dates and status.

Regular users must never be able to access another user's PAN,
application records, private trader rates, admin margins, or financial
reports.

Implement server-side authorization for every sensitive operation.
Hiding a button in React is not sufficient.

Registration should be controlled by the admin or an invitation system.
Do not automatically expose a public registration system if one is not
already required by the project.

------------------------------------------------------------------------

## 4. Dashboard

Create a modern, responsive dashboard with a polished
financial-management interface.

### Admin dashboard metrics

Display: - Total registered users. - Total active users. - Total IPOs. -
Upcoming IPOs. - Currently open IPOs. - Closed IPOs awaiting allotment
or settlement. - Total applications. - Total applications funded by
me. - Total applications funded by users. - Total capital deployed by
me. - Total user-funded capital recorded. - Total expected gross
profit. - Total expected user payouts. - Total expected net earnings for
me. - Total realized earnings. - Pending settlements. - Recent
applications. - Recent IPO rate changes. - Upcoming IPO opening and
closing dates.

Include filters for date range, IPO, user, funding source, and
settlement status.

Show charts for: - Earnings over time. - Applications by IPO. -
Applications by funding source. - Expected versus realized profit. -
Capital deployed over time.

Every metric must be derived from actual database records. Do not use
fake values or hardcoded dashboard statistics.

Clearly distinguish estimates from finalized results.

### User dashboard

Display: - Upcoming IPOs. - Currently open IPOs. - Current published
rates. - The user's application count. - Their recent application
history. - Their saved PAN count. - Their own payout and settlement
summaries, if enabled.

------------------------------------------------------------------------

## 5. IPO Data Management and External APIs

I want to fetch IPO information from one of the following sources:

1.  Upstox API, subject to the available API products, permissions, and
    documentation.
2.  https://ipoalerts.in/ipo-data-api

Inspect the official documentation for the available providers before
implementing an integration. Do not invent endpoints, authentication
methods, response fields, or API capabilities.

Build a provider abstraction so that I can configure or switch between
supported providers without rewriting the application.

For example, create a common interface for fetching IPO data and
provider-specific implementations behind it.

### IPO fields

Store the following fields when provided by the data source: - IPO
name. - Company name. - IPO symbol or identifier. - Exchange. - IPO
type. - Mainboard or SME classification. - IPO opening date. - IPO
closing date. - Allotment date. - Listing date. - Price band minimum and
maximum. - Issue price, when available. - Lot size. - Minimum retail
application information, when available. - Issue size, when available. -
Listing or GMP-related information, when provided by a supported
source. - IPO status. - Source provider. - Last synchronization
timestamp. - Original provider identifier.

Add other useful fields only when supported by the source or needed by
the application.

### IPO synchronization

Provide: - A manual "Sync IPOs" action. - A provider connection and
status screen. - A scheduled synchronization option. - Duplicate
prevention. - Safe updates to existing IPO records. - Error logging and
retry support. - A visible last-synced timestamp. - Clear handling for
unavailable or stale data.

Do not overwrite my manually configured rates when synchronizing
provider data.

External IPO data and my internal commercial rates must be stored
separately.

If a provider does not supply a field, leave it unavailable rather than
inventing a value.

The application is for managing records and calculations. Do not
implement automated IPO applications, brokerage transactions, or trading
actions.

------------------------------------------------------------------------

## 6. IPO Listing and Detail Pages

Create a searchable and filterable IPO listing page.

Each IPO card or table row should display: - IPO name. - Open and close
dates. - IPO status. - Price band. - Lot size. - Latest available GMP,
if supported. - My published user rate. - Total application count. -
Relevant synchronization status.

When I open an IPO, show a detailed workspace with tabs.

### Tab A: Overview

Show IPO information, dates, market data, current rates, application
totals, funding breakdown, financial summary, and settlement status.

### Tab B: Applications

Display all application records associated with the selected IPO,
grouped by user and application batch.

Columns should include: - User name. - Application batch. - Number of
applications. - PAN reference, masked by default. - Applied rate per
application. - Funding source. - Recorded capital amount. - Expected
gross profit. - Expected user payout. - Expected net earnings. -
Application status. - Settlement status. - Created date.

Allow searching, filtering, sorting, pagination, and exporting.

### Tab C: Rates and History

Display: - Current trader rate. - Current published user rate. - Current
calculated margin. - Rate effective date. - Previous rates. -
Rate-change timestamps. - Who changed each rate. - Relevant application
batches associated with each historical rate.

### Tab D: Funding and Profit

Display a separate financial summary for: - My-funded applications. -
User-funded applications. - Expected earnings. - Realized earnings. -
Capital deployed. - User payouts. - Pending settlements.

### Tab E: Exports

Provide separate CSV exports for: - All applications. - Application data
grouped by user. - PAN and application submission data. - Funding and
profit reports. - A selected date range or selected application batches.

All exports must respect the selected IPO and filters.

------------------------------------------------------------------------

## 7. Rate Management --- Critical Business Requirement

The system must distinguish between three concepts.

### A. External trader rate

This is the rate quoted to me by my trader friend for a particular IPO.

Example: ₹1,000 per application.

This rate is private and must never be visible to regular users.

### B. Published user rate

This is the rate I offer to my friends.

Example: ₹800 per application.

My margin is the difference between the trader rate and my published
rate.

For example:

-   Trader rate: ₹1,000.
-   Published user rate: ₹800.
-   Margin: ₹200 per application.
-   If 5 applications are recorded at ₹800, the configured rate
    difference is ₹1,000 in total.

This is the configured margin calculation, not necessarily realized
profit. Actual financial results must be based on the relevant
settlement data and funding arrangement.

### C. Rate history

I must be able to change rates at any time.

For example:

1.  I set the trader rate to ₹1,000 and the published rate to ₹800.
2.  User A submits two applications at ₹800.
3.  Later, I change the published rate to ₹1,000.
4.  User A submits two more applications at ₹1,000.

The application must retain two separate batches:

  Batch       Applications   Applied rate
  --------- -------------- --------------
  Batch 1                2           ₹800
  Batch 2                2         ₹1,000

Changing the current rate must not alter Batch 1.

Implement immutable application-level rate snapshots. Each application
batch must preserve the applicable trader rate, published rate, margin,
rate configuration ID, and timestamp at the time of submission.

Past application batches must never silently inherit a new rate.

### Rate editing interface

Provide a simple admin form to: - Edit the trader rate. - Edit the
published rate. - Set an effective date and time. - Add an internal note
explaining the change. - Review the margin before saving. - Confirm the
change.

Store the previous and new values in an audit log.

If the rate becomes invalid, such as a published rate exceeding the
trader rate when the selected pricing policy prohibits that, display a
validation error or require an explicit admin override.

Do not silently change the user's previous rate or financial records.

------------------------------------------------------------------------

## 8. User Management and Saved PAN Records

Create a dedicated PAN management module.

Each user may have multiple saved PAN records, and each PAN should be
reusable across multiple IPO applications where appropriate.

### PAN fields

Store: - PAN number. - Optional display name or account holder name. -
Optional account or broker reference. - Optional notes. - Verification
status. - Creation date. - Last updated date.

PAN numbers must be normalized and validated for format. Do not claim
that a PAN is government-verified merely because it passes format
validation.

### PAN management features

-   Add PAN manually.
-   Edit or deactivate a saved PAN.
-   Select an existing PAN when creating an application batch.
-   Add a new PAN directly from the application form.
-   Prevent duplicate PAN records for the same user.
-   Allow authorized admin operations where needed.
-   Mask PAN values by default.
-   Reveal full PAN values only to authorized users after appropriate
    confirmation or access checks.
-   Provide controlled CSV exports for the admin.

A user should be able to choose a saved PAN from a dropdown instead of
typing it repeatedly.

For multiple applications, allow selecting a PAN for each application or
explicitly recording the PAN-to-application relationship according to
the chosen workflow.

Do not assume every application belonging to one user must use the same
PAN.

### Automatic PAN fetching

Investigate whether an authorized, legitimate API is available for the
exact PAN information retrieval required.

Do not invent a PAN lookup API or scrape government systems.

If no supported and authorized API is available, implement manual PAN
entry as the reliable default.

Keep any future PAN lookup integration behind a provider interface. Show
the source and verification status of any retrieved information.

Do not store PAN information in application logs, error traces,
analytics events, or unprotected URLs.

Encrypt sensitive PAN data at rest where feasible, restrict decryption
access, and ensure backups and exports are appropriately protected.

------------------------------------------------------------------------

## 9. Application Batch Management

This is one of the most important modules.

I need to record how many applications each user submits for a specific
IPO and at which rate.

Create an application-batch workflow.

### New batch form

Fields: - IPO. - User. - Saved PAN selection. - Number of
applications. - Funding source: "My Money" or "User Money". - Rate
applicable to this batch. - Capital amount per application, when
known. - Total capital amount. - Application submission date. - External
trader reference, if needed. - Application status. - Settlement
status. - Notes.

The IPO and user should be selectable using searchable dropdowns.

When I select an IPO and user, show the current applicable rate and
allow an authorized admin to override the rate for that particular batch
if required.

The saved batch must snapshot the final selected rate.

The user-facing form should default to the current published rate and
should not expose private trader rates or admin-only margins.

### Batch records

For every batch, retain: - Unique batch ID. - IPO ID. - User ID. -
Associated PAN record or records. - Number of applications. - Trader
rate snapshot. - Published rate snapshot. - Margin snapshot. - Funding
source. - Recorded capital amount. - Expected gross profit, when
known. - Expected user payout. - Expected net earnings. - Actual
settlement values, once known. - Status and timestamps. - Creator and
last editor.

Allow authorized admins to: - Create a batch. - View its complete
history. - Correct mistakes with a recorded audit trail. - Cancel or
mark a batch as invalid without silently deleting its history. - Add
settlement information. - View rate and funding details.

Do not use hard deletes for financially meaningful application records.

### Application-level PAN mapping

If a batch contains multiple applications, support mapping individual
PANs to individual application entries where required.

For example, a batch of three applications could be associated with
three PAN/application entries. Preserve the exact relationship between
the user, PAN, batch, and IPO.

Prevent accidental duplicate entries through validation and duplicate
warnings, but allow legitimate multiple applications when the business
workflow permits them.

------------------------------------------------------------------------

## 10. Funding Source and Financial Calculations

Every application batch must have a funding source:

1.  My Money.
2.  User Money.

The funding source must be saved per batch and must never change
automatically when rates or IPO data change.

Implement a configurable calculation engine rather than scattering
financial formulas across React components.

### A. Rate margin

For each application:

Rate margin = Trader rate − Published user rate

For a batch:

Configured batch margin = Rate margin × Application count

This measures the configured difference between the trader rate and the
user-facing rate. Do not automatically label it realized profit.

### B. Gross profit and user payout

I may have a gross expected profit amount for an IPO or application
batch. For example, an estimated ₹2,000 gross profit with a fixed ₹500
payout to a user.

Support configurable financial inputs: - Expected gross profit per
application or batch. - Actual gross profit per application or batch,
when known. - Fixed user payout per application. - Optional expenses or
adjustments. - Final settled user payout.

Do not assume the IPO's GMP equals actual profit or actual allotment
proceeds.

When market data does not provide a reliable profit figure, let me enter
or update the estimate manually.

### C. My Money

For batches funded by my own money, track: - Capital deployed by me. -
Expected gross proceeds or profit. - Expenses and adjustments. - Final
realized proceeds or profit. - Any applicable external payout
obligations. - My net realized earnings.

Keep invested capital separate from profit so that returning capital is
not counted as earnings.

### D. User Money

For batches funded by users, track: - User-funded capital. - Expected
gross profit. - Agreed fixed payout. - External trader obligations,
where applicable. - Expenses and adjustments. - My configured margin. -
Final amount due to the user. - My expected and realized net earnings.

### E. Settlement inputs

Because the actual profit and settlement arrangement can differ by IPO,
make the calculation rules configurable and record the method used.

For each batch, support: - Estimated. - Partially settled. - Fully
settled. - Cancelled or invalidated.

Record the relevant dates, amounts, and adjustment reasons.

### F. Prevent double counting

The dashboard must not add the same earnings from the rate-margin model
and gross-profit/payout model as if they were two independent profits.

Each financial calculation must have a clearly defined source and
formula.

Provide a settings area where I can choose the financial model used for
each arrangement. Clearly label any provisional calculations and require
settlement information before classifying earnings as realized.

Include automated tests for all supported calculation models.

------------------------------------------------------------------------

## 11. CSV Export --- Required

I need to export CSV files separately for every IPO.

Provide a visible "Export CSV" action on the IPO detail page and the
applications table.

Support: - All application batches for the selected IPO. - Applications
filtered by user. - Applications filtered by funding source. -
Applications filtered by application or settlement status. - Selected
date range. - Selected batches. - PAN submission sheet. - Financial
summary.

The PAN submission export should contain the exact columns required by
the external trader's workflow. Make the export column mapping
configurable rather than assuming the trader uses a specific format.

Potential fields: - IPO name or identifier. - User name. - Application
or batch ID. - PAN number. - Number of applications. - Applicable
rate. - Funding source. - Submission date. - Notes.

Provide a separate financial export containing trader rates, published
rates, margins, capital, payouts, and earnings. Do not accidentally
expose these private fields in a user-facing PAN submission file.

### CSV requirements

-   Correct CSV escaping.
-   UTF-8 encoding.
-   Stable column order.
-   Useful filenames containing the IPO name and export date.
-   Proper handling of commas, quotes, newlines, and empty fields.
-   Correct decimal formatting.
-   Pagination-independent complete exports.
-   Authorization checks.
-   Export audit logs.
-   Clear warnings when full PAN values are included.
-   CSV formula-injection protection for text fields that could be
    interpreted as spreadsheet formulas.

All CSV generation must run server-side and use the selected filters. Do
not generate incomplete exports from only the currently visible frontend
table.

------------------------------------------------------------------------

## 12. Application Status and Settlement Workflow

Create configurable statuses for the application lifecycle.

Suggested statuses: - Draft. - Ready for submission. - Submitted to
trader. - Submission confirmed. - Pending allotment. - Allotted. - Not
allotted. - Awaiting settlement. - Partially settled. - Settled. -
Cancelled.

Keep application status separate from financial settlement status.

Allow the admin to update statuses manually and record: - Previous
status. - New status. - Change timestamp. - User who made the change. -
Notes.

Do not infer actual allotment or settlement from GMP or listing price.

If automatic status updates are added later, use a supported provider
and preserve a manual override with an audit trail.

------------------------------------------------------------------------

## 13. Database Design

Design a normalized schema appropriate for the requirements.

Consider tables or equivalent models for: - users and roles. - IPOs. -
IPO provider records or identifiers. - IPO market-data snapshots, if
needed. - User PAN records. - IPO rate configurations. - IPO rate
history. - Application batches. - Individual application/PAN mappings,
if needed. - Funding records. - Financial estimates and calculations. -
Settlement transactions. - Expenses and adjustments. - Status history. -
Audit logs. - API synchronization logs. - Application settings.

Use appropriate relationships, foreign keys, indexes, unique
constraints, and database transactions.

Use integer paise or suitable fixed-precision decimal storage for
monetary values. Never use floating-point arithmetic for financial
calculations.

Store timestamps consistently and display them in the configured local
timezone.

Historical application records must remain correct even when current IPO
data, user information, rate settings, or funding policies change.

Create migrations and seeders that are safe to run against the existing
project.

Do not delete existing users or existing application data.

------------------------------------------------------------------------

## 14. Security and Privacy

This application stores sensitive PAN information and private financial
data. Treat security as a core feature.

Implement: - Server-side authorization on every protected endpoint. -
Validation for all incoming requests. - CSRF protection and secure
session handling appropriate to the existing authentication setup. -
Rate limiting for authentication and sensitive operations. - Secure
environment-variable storage for API credentials. - Encryption for
sensitive PAN data at rest where feasible. - Masked PAN display by
default. - Restricted PAN reveal and export permissions. - Audit logging
for sensitive data access and financial changes. - Protection against
mass assignment and insecure direct object references. - Safe error
responses without exposing secrets or PAN values. - No PAN data in
application logs. - No secret API keys in React environment variables or
client bundles. - Safe handling of CSV exports and downloads. - Database
transactions for multi-step financial updates.

Avoid logging raw request payloads containing PAN data.

Do not store banking passwords, brokerage passwords, OTPs, or unrelated
authentication credentials.

------------------------------------------------------------------------

## 15. UI/UX Requirements

Build a polished, professional dashboard suitable for frequent personal
use.

Design direction: - Clean financial SaaS interface. - Dark mode and
light mode if supported by the existing UI stack. - Responsive sidebar
navigation. - Compact but readable data tables. - Searchable
dropdowns. - Clear monetary formatting in INR. - Good empty states. -
Skeleton loading states. - Toast notifications. - Confirmation dialogs
for sensitive actions. - Inline validation errors. - Responsive layouts
for desktop and mobile. - Consistent spacing, typography, cards, badges,
and form layouts.

Suggested navigation:

**Admin** - Dashboard - IPOs - Applications - Users - PAN Registry -
Rates and Margins - Funding and Settlements - Reports and Exports - API
Integrations - Activity Logs - Settings

**User** - Dashboard - IPOs - My Applications - My PANs - My
Settlements, if enabled - Profile

Use reusable components and avoid duplicating entire pages for similar
operations.

Every page must be connected to real backend data. Do not leave
placeholder buttons, mock tables, or hardcoded chart values in the final
implementation.

------------------------------------------------------------------------

## 16. Implementation Plan

Implement the project in phases, but continue until the complete
application is functional.

### Phase 1 --- Inspect and prepare

-   Inspect the existing codebase and authentication.
-   Document the existing architecture.
-   Identify reusable components and packages.
-   Establish a short implementation plan.
-   Preserve existing functionality.

### Phase 2 --- Database and permissions

-   Create the migrations and models.
-   Implement roles and authorization.
-   Build the user and PAN modules.
-   Add validation and audit logging.

### Phase 3 --- IPO management

-   Build IPO CRUD.
-   Implement provider adapters.
-   Add manual synchronization and sync logs.
-   Add scheduled synchronization where appropriate.

### Phase 4 --- Rates and applications

-   Implement trader rates and published rates.
-   Build immutable rate snapshots and rate history.
-   Build application batches and PAN mapping.
-   Add funding source selection.
-   Implement the configurable financial calculation engine.

### Phase 5 --- Dashboards and reports

-   Build the admin and user dashboards.
-   Implement IPO detail tabs.
-   Add filters, summaries, charts, and settlement workflows.

### Phase 6 --- CSV exports

-   Implement complete server-side exports.
-   Add configurable export templates.
-   Add PAN privacy protections and export auditing.

### Phase 7 --- Testing and completion

-   Run database migrations.
-   Run backend and frontend tests.
-   Fix all implementation errors.
-   Test the rate-change scenario described above.
-   Verify access controls using both admin and regular-user accounts.
-   Verify that one user cannot retrieve another user's PAN or
    applications.
-   Test CSV exports with multiple batches and special characters.
-   Test profit calculations for both funding sources.
-   Verify that provider synchronization does not overwrite internal
    rates.
-   Check browser console errors and backend logs.
-   Verify the complete application from login to final export.

Do not stop after building the dashboard or database models. Complete
the end-to-end workflows.

------------------------------------------------------------------------

## 17. Acceptance Criteria

The application is complete only when the following scenarios work.

**Scenario 1: Rate changes**

1.  Set an IPO's trader rate to ₹1,000 and published rate to ₹800.
2.  Create a batch for User A with two applications.
3.  Change the published rate to ₹1,000.
4.  Create another batch for User A with two applications.
5.  Verify that the first batch still uses ₹800 and the second uses
    ₹1,000.
6.  Verify that historical margin calculations use the corresponding
    snapshots.

**Scenario 2: Funding source**

1.  Create one batch funded by my money.
2.  Create another batch funded by user money.
3.  Verify that the capital, expected profit, payouts, and earnings are
    reported separately.
4.  Verify that dashboard totals do not double-count earnings.

**Scenario 3: Saved PANs**

1.  Save multiple PAN records for a user.
2.  Create a new application batch.
3.  Select a saved PAN from a dropdown.
4.  Add a different PAN manually.
5.  Verify that the correct PAN-to-application relationships are
    retained.
6.  Verify that another user cannot access those PAN records.

**Scenario 4: CSV export**

1.  Open an IPO with several users and multiple rate batches.
2.  Export the PAN submission CSV.
3.  Verify that all matching records are included and that rates remain
    correct.
4.  Export the financial report separately.
5.  Verify that private trader rates and margins do not leak into the
    PAN submission export.

**Scenario 5: Provider synchronization**

1.  Synchronize IPO data from a configured provider.
2.  Verify that duplicate IPOs are not created.
3.  Verify that existing application batches remain unchanged.
4.  Verify that internal rates are not overwritten.
5.  Verify that API errors are recorded and reported clearly.

**Scenario 6: Settlement**

1.  Create estimated financial records.
2.  Record actual settlement information.
3.  Verify that expected and realized earnings are shown separately.
4.  Verify that capital returned is not counted as profit.
5.  Verify that adjustments are auditable.

------------------------------------------------------------------------

## 18. Final Instructions

Work directly in the current repository.

Make sensible implementation decisions without asking me about every
minor detail. If a decision materially affects the financial model,
privacy, or the meaning of profit, implement a configurable option and
document the assumption.

Prioritize correctness of historical rates, financial calculations, PAN
privacy, and application-level auditability over decorative UI work.

Do not fabricate external API capabilities. If a provider requires
credentials, implement the integration using environment variables and
provide a clear setup guide.

Do not claim PAN verification unless a supported verification source
confirms it.

Do not claim financial results are actual unless the necessary
settlement information has been recorded.

After implementation: 1. Summarize the modules completed. 2. List the
migrations and important files created or changed. 3. Document required
environment variables and external API setup. 4. Explain how to run
migrations, tests, and scheduled jobs. 5. Provide a brief guide to
creating users, configuring rates, recording applications, settling
batches, and exporting CSVs. 6. Clearly identify anything that remains
incomplete or requires external credentials.

Start by inspecting the existing repository, then implement the complete
application in the existing project. Do not merely return a plan or code
snippets; make the actual changes and verify them.
