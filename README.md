# JewelloSoft - Jewellery Retail and Billing Software (Community Edition)

[![License: JewelloSoft CE](https://img.shields.io/badge/License-JewelloSoft%20CE-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-informational.svg)](https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest)
[![Release](https://img.shields.io/github/v/release/SudeeptoBhakat/Jewellosoft?label=Latest%20Release)](https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest)
[![Total Downloads](https://img.shields.io/github/downloads/SudeeptoBhakat/Jewellosoft/total?label=Total%20Installs)](https://github.com/SudeeptoBhakat/Jewellosoft/releases)

JewelloSoft is a modern, offline-first desktop application engineered for jewellery shop owners. It provides a complete, professional environment to manage billing, inventory, customer relationships, custom orders, payment tracking, and cloud-backed data synchronization — all running natively on Windows without an internet connection.

Built on an enterprise-grade stack of Electron, React, and Django, JewelloSoft is designed to serve as the primary operational system for single-location jewellery retail businesses.

---

## Table of Contents

- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [Download and Install](#download-and-install)
- [Architecture and Security](#architecture-and-security)
- [Development Setup](#development-setup)
- [Building for Production](#building-for-production)
- [Roadmap](#roadmap)
- [Author](#author)
- [License](#license)

---

## Core Features

### Billing and Invoicing

- Generate professional, print-ready PDF invoices and estimates from a structured billing form.
- Automated calculation engine covering metal value, making charges, discounts, round-off adjustments, and hallmark charges.
- Full GST compliance with dynamic CGST, SGST, and IGST computation, configurable per shop.
- Support for both Invoice and Estimate document types, each linkable to a customer order.
- Old metal settlement integrated directly into the billing workflow, supporting three modes: settlement by weight at live or saved rate, by direct rupee value, or by adjustment against a pre-issued purchase voucher.
- Multiple payment methods per bill: Cash, UPI, Card.
- Configurable PDF invoice templates (Classic and Standard) with optional shop logo watermark.
- Auto-generated, sequential invoice and estimate numbering managed per shop.

### Inventory Management

- Track and manage jewellery stock using HUID and SKU-based product identification.
- High-resolution product image upload with local unified media storage.
- Automated stock deduction upon invoice finalization, maintaining accurate on-hand counts.
- Inventory items link directly to billing and order line items for full traceability.

### Customer Relationship Management

- Comprehensive customer database with full contact and profile information.
- Fast-indexed search and advanced filtering across the entire customer registry.
- Complete 360-degree customer view: linked order history, billing history, advance payment history, and current ledger balance.
- Customer ledger automatically posts all debit and credit entries across payments, refunds, and order activity.

### Custom Order Management

- Full custom jewellery order workflow from creation through delivery.
- Per-item production status tracking: Created, Processing, Karigar Assigned, In Progress, Hallmarking, Ready, Complete, Cancelled.
- Order-level lifecycle management: Pending, In Progress, Completed, Delivered, Cancelled.
- Attach design notes, reference images, size specifications, worker assignment, and priority level to each order.
- Configurable delivery date per order with optional enforcement of full payment before delivery is permitted.
- Payment status auto-calculated and updated in real time: Pending, Partially Paid, Paid, Overpaid.

### Advance Payment and Receipt Management

- Record advance payments against customer orders with auto-generated, sequential receipt numbers.
- Support for mixed-mode payment splits across Cash, UPI, Card, Bank Transfer, and Cheque within a single transaction.
- Refund issuance against advance payments with audit trail and dedicated refund receipt numbering.
- Each advance payment and refund automatically posts to the customer ledger and the shop cash book.
- Advance amounts deducted from the grand total during final billing.
- Full cancellation workflow for advance receipts with mandatory reason logging and automatic ledger reversal.

### Old Metal Purchase Workflow

- Issue standalone old metal purchase vouchers when buying used jewellery or scrap from customers before a sale.
- Records metal type, purity grade, number of articles, gross weight, net weight, rate at time of purchase, and computed settlement amount.
- Vouchers remain in Not Adjusted state and are available for lookup during billing.
- Atomic adjustment: when applied to an invoice or estimate, the voucher is locked to that document. If the associated bill is deleted, the voucher is automatically reset to Not Adjusted, preserving full data integrity.
- During billing, the voucher can be applied at the original saved rate or the current live market rate.

### Payment Ledger and Cash Book

- Per-shop cash book recording all financial inflows and outflows across Cash, UPI, Card, and Bank Transfer.
- Advance payments, refunds, and cancellations automatically post entries to both the customer ledger and the cash book with accurate debit/credit classification.
- Full payment history per invoice and estimate, including payment mode and timestamp.
- Mixed-mode payments are split and recorded individually per payment channel in the cash book.

### Live Metal Rate Management

- Maintain live Gold and Silver market rates per 10 grams within the application.
- Rates are automatically propagated to billing forms and order cost calculations.
- Historical rate log preserved per shop for audit and reconciliation.
- Making charge rate maintained and tracked separately per metal type.

### Offline-First Architecture and Cloud Synchronization

- Operates fully offline using a local SQLite database. Internet connectivity is not required for day-to-day operations.
- Background synchronization daemon silently pushes customer records and shop configuration to a secured Supabase cloud instance upon internet reconnection.
- Persistent synchronization queue tracks all pending, failed, and completed sync operations with attempt count and error logging, ensuring no data loss during intermittent connectivity.
- Supabase JWT-based identity binding with a strict one-tenant-per-device structure prevents cross-account data exposure.

### Shop Configuration and Settings

- Configurable shop profile: name, owner, address, phone, email, GST number, PAN number.
- Theme selection, language preference, and date format customization.
- Configurable default GST and IGST rates applied globally to billing.
- Decimal precision settings for weight and currency display.
- Default hallmark charge value configurable per shop.
- PDF invoice template selection with optional logo watermark upload.
- Optional enforcement of full payment before order delivery is permitted.

### License Validation

- Offline license key validation using AES/Fernet symmetric cryptography bundled within the application binary.
- License state is verified locally at startup without any network call.

### Automatic Updates

- Built-in auto-update pipeline via electron-updater tracking GitHub Releases.
- Automatically detects, downloads, and prompts the user to install new versions directly from within the application UI.
- Continuous delivery pipeline managed through GitHub Actions with NSIS installer artifact generation.

---

## Technology Stack

| Layer                         | Technology                                 |
| ----------------------------- | ------------------------------------------ |
| Frontend Framework            | React + Vite                               |
| Backend API Layer             | Python Django + Django REST Framework      |
| Production WSGI Server        | Waitress (bundled via PyInstaller)         |
| Desktop Orchestration         | Electron.js                                |
| Local Offline Database        | SQLite                                     |
| Cloud Authentication / Sync   | Supabase                                   |
| PDF Generation                | Server-side rendered PDF via Django        |
| Installer                     | NSIS via electron-builder                  |
| CI/CD Pipeline                | GitHub Actions                             |

---

## Download and Install

**Download the Latest Production Release:**
[Download JewelloSoft Setup.exe](https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest)

### Installation Steps

1. Download the `.exe` installer from the link above.
2. Run the installer and grant administrator privileges when prompted by Windows UAC.
3. Follow the setup wizard to complete installation.
4. Launch JewelloSoft from the Desktop shortcut or Start Menu entry.

---

## Architecture and Security

**Django Standalone Bundle**
The Python/Django backend is compiled into a fully self-contained frozen executable using PyInstaller. No Python installation is required on the end user's machine. It exposes a local WSGI HTTP server via Waitress, bound exclusively to localhost, and is invisible to external network interfaces.

**Separation of Concerns**
The Electron shell manages the desktop window and application lifecycle. The React frontend communicates exclusively with the locally running Django API over localhost. No frontend code communicates directly with Supabase — all cloud operations are mediated by the backend.

**Encrypted Licensing**
License keys are validated offline using AES/Fernet cryptography. The encrypted license state is stored locally and verified at application startup without requiring a network call.

**Single-Tenant Security**
Each installed instance is bound to exactly one shop profile. The Supabase user identity is stored and validated locally to prevent unauthorized profile substitution or cross-tenant data access.

**Audit-Traceable Sync Queue**
The synchronization queue model maintains a persistent log of every pending cloud operation, including model name, action type, serialized payload, attempt count, and error detail. This guarantees data consistency across connectivity interruptions.

---

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/SudeeptoBhakat/Jewellosoft.git
cd Jewellosoft
```

### 2. Backend Initialization (Django)

Requires Python 3.10 or later.

```bash
cd backend
python -m venv .venv

# Activate on Windows
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
python manage.py migrate

# Start the development server
python manage.py runserver
```

### 3. Frontend Initialization (React)

Requires Node.js 18 or later.

```bash
cd frontend
npm install
npm run dev
```

### 4. Desktop Shell (Electron)

```bash
cd desktop
npm install
npm start
```

---

## Building for Production

JewelloSoft uses GitHub Actions for automated continuous delivery. To build locally:

```bash
# Build the React frontend bundle
cd frontend
npm run build

# Compile the Python backend into a standalone executable (Windows)
cd backend
python build_backend.py

# Build the Electron NSIS installer
cd desktop
npm run build
```

Output artifact: `desktop/dist/JewelloSoft Setup.exe`

---

## Roadmap

- Multi-location branch synchronization with consolidated cross-branch reporting.
- Barcode and QR Code scanning integration for rapid inventory lookup.
- Daily market price rate feed integration.
- Role-based access control (RBAC) for multi-staff logins with permission scoping.
- Sales analytics dashboard with date-range and category-level reports.

---

## Author

**Sudeepto Bhakat**
Lead Backend Engineer and Systems Architect
[sudeeptabhakat84645@gmail.com](mailto:sudeeptabhakat84645@gmail.com)

---

## License

This repository is distributed under the JewelloSoft Community License.

### Permitted Use

- Personal use
- Educational use
- Internal business use
- Modification and contribution

### Prohibited Use

- Resale or commercial redistribution
- Offering as a paid subscription or SaaS product
- Any form of commercial licensing to third parties

Commercial rights are reserved exclusively by Sudeepta Bhakat.
