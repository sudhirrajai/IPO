# IPO Management & Real-Time Tracking Platform

A modern, production-ready IPO management, Grey Market Premium (GMP) tracking, PAN registry, and profit settlement web application built with **Laravel 13**, **React 19**, **Inertia.js v3**, **Tailwind CSS v4**, and **Wayfinder**.

---

## Key Features

- **Live IPO Feeds & Categorization:** Automatically syncs and categorizes IPOs into Open, Upcoming, and Closed bidding windows with daily cutoff schedules.
- **InvestorGain Real-Time GMP Scraper:**
  - Automated background scraper scraping live GMP, gain percentages, and subscription rates (`x`) from [InvestorGain](https://www.investorgain.com/report/ipo-gmp-live/331/).
  - Automatic detection of Mainboard vs SME issues.
  - Background scheduler running every 30 minutes via Laravel console scheduler (`php artisan ipo:scrape-gmp`).
  - Interactive manual GMP override and 1-click on-demand sync from the Provider & Sync dashboard.
- **User-Friendly Low-Scroll Bento Workspace (`/ipos/{id}`):**
  - Above-the-fold 4-KPI metrics: Price band, minimum 1-lot investment, live GMP with dynamic gain percentage, subscription demand, and bidding window.
  - Horizontal visual milestone timeline (Bidding ➔ Allotment ➔ Refund / Mandate Unblock ➔ Listing Day).
  - High-density specification table with 1-click ISIN code copy.
  - Interactive Lot & Profit Estimator with instant 1-click lot selection pills (`1`, `2`, `5`, `10` lots).
  - Official filings & prospectus direct access (DRHP / RHP PDFs and registrar allotment portal).
- **Direct Application Filing & Profit Sharing:**
  - Record applications with or without pre-configured fixed rates.
  - Flexible profit-sharing modes: Flat rate (`₹`), Percentage of listing gain (`%`), or Trader Rate Margin.
  - Instant 1-click allotment actions (`[✓ Allotted]` / `[✗ Not Allotted]`) directly from application tables.
- **Bank Account & Saved UPI Linking:**
  - Fast bank management (add bank by name in seconds).
  - Save and link UPI IDs directly to bank accounts.
  - Automatic UPI app detection (Google Pay, PhonePe, Paytm, BHIM, Cred, Amazon Pay) from VPA handle.
  - Auto-filling of linked bank accounts when selecting a saved UPI ID during application entry.
- **Full-Page Multi-Ring Circular Loader & Eager Prefetching:**
  - Glassmorphic backdrop loader with multi-ring animation and context-aware action labels.
  - Hover-based eager prefetching via Inertia v3 for instantaneous page loads.

---

## Tech Stack

- **Backend:** PHP 8.2+, Laravel 13, SQLite / MySQL / PostgreSQL, Pest PHP
- **Frontend:** React 19, Inertia.js v3, TypeScript, Tailwind CSS v4, Lucide Icons, Shadcn UI
- **Routing & Types:** Laravel Wayfinder (auto-generated typed controller routes)

---

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sudhirrajai/IPO.git
   cd IPO
   ```

2. **Install dependencies:**
   ```bash
   composer install
   npm install
   ```

3. **Environment Setup:**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. **Database & Migrations:**
   ```bash
   touch database/database.sqlite
   php artisan migrate --seed
   ```

5. **Build Assets & Run Dev Server:**
   ```bash
   npm run build
   # or for development: npm run dev
   php artisan serve
   ```

---

## Scheduled Tasks & Background Scraping

Run the scheduled tasks locally or via cron:
```bash
php artisan schedule:run
```

Trigger the InvestorGain live GMP scraper manually:
```bash
# Dry-run inspection:
php artisan ipo:scrape-gmp --dry-run

# Live sync:
php artisan ipo:scrape-gmp
```
