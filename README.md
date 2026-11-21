# 🧾 Professional Invoice Application

A modern, role-based desktop invoice management application built with **Electron + React + Vite + Tailwind CSS**, powered by a **Google Sheets Database** (with automatic offline cache).

Designed specifically for **Admins, Vendors, and Sellers** with complete customization capabilities.

---

## 🌟 Key Features

### 👑 Role-Based Access Control
- **Admin**: Complete system control, customize branding (logo, theme color, terms, currency, taxes), manage all users and roles, access system-wide financial analytics.
- **Vendor**: Manage catalog of products and services, create invoices, track payments, view vendor-specific sales reports.
- **Seller**: Manage client accounts, generate sales invoices, record customer payments, monitor outstanding balances.

### 📊 Comprehensive Financial Modules
1. **Interactive Dashboard**: Revenue KPIs, monthly trends, status breakdowns, recent transaction logs, quick-action shortcuts.
2. **Invoice Management**:
   - Auto-generated invoice numbering with customizable prefixes (e.g., `INV-1004`).
   - Line-item tax computation (GST, VAT, Sales Tax) & discounts (Percentage or Flat).
   - Multi-currency support (USD, EUR, GBP, INR, JPY, CAD, AUD, etc.).
   - Print-ready invoice rendering & instant PDF download via `jspdf` and `html2canvas`.
   - Real-time status badges: `Draft`, `Sent`, `Paid`, `Partial`, `Overdue`, `Cancelled`.
3. **Customer Directory**: Full contact registry with categories (VIP, Wholesale, Retail, Regular).
4. **Product & Service Catalog**: SKU tracking, categorised listings, custom pricing, tax rates, and inventory monitoring.
5. **Payment Tracking**: Full and partial payment recording, transaction references (Bank Transfer, Credit Card, UPI, Cash), and balance tracking.
6. **Reports & Analytics**: Visual revenue vs. collections charts, top customer rankings, payment method distributions, and one-click CSV data export.
7. **Admin Customization Suite**: Company branding, logo, contact info, invoice defaults, dynamic color themes, and Google Sheets cloud database configuration.

---

## 📁 Google Sheets Live Database Integration

The application synchronizes with a **Google Spreadsheet** in two modes:

### Mode 1: Google Apps Script Web App (Recommended — 100% Free & Fast)
1. Open [Google Sheets](https://sheets.new) and create a new sheet.
2. Open **Extensions > Apps Script**.
3. Copy and paste the script provided in `google-apps-script.js`.
4. Click **Deploy > New deployment**, select **Web app**, set access to **Anyone**, and click **Deploy**.
5. Copy the generated Web App URL and paste it into **Settings > Google Sheets** in the application.
6. All 7 tables (`Users`, `Customers`, `Products`, `Invoices`, `InvoiceItems`, `Payments`, `Settings`) will sync live in real-time!

### Mode 2: Google Sheets API v4
- Provide your **Spreadsheet ID** and **Google API Key** in Settings.

### Mode 3: Built-in Offline Mode
- The application automatically caches all data locally using browser storage with pre-seeded sample data, ensuring lightning-fast performance even with no internet connection.

---

## 🚀 Getting Started

### Default Login Accounts

| Role | Username | Password |
|---|---|---|
| **Admin** | `admin` | `admin123` |
| **Vendor** | `vendor1` | `vendor123` |
| **Seller** | `seller1` | `seller123` |

### Running the Application

```bash
# Install dependencies
npm install

# Start Vite dev server (Web Mode)
npm run dev

# Start Electron Desktop App
npm run electron:dev

# Build production installer
npm run electron:build
```
