Here’s a **professional production-ready `README.md`** for your **JewelloSoft Desktop Application** 👇

---

# JewelloSoft – Smart Jewellery Billing & Inventory Desktop App

JewelloSoft is a **modern, offline-first desktop application** built for jewellery shop owners to manage **billing, inventory, customers, and orders** with a seamless and professional experience.

Designed with a powerful stack (**Electron + React + Django**), it delivers **high performance, local data storage, and beautiful invoice generation** — all without requiring a browser.

---

## Features

### Billing & Invoicing

* Generate professional invoices instantly
* Auto calculation using advanced pricing engine
* GST (CGST/SGST), making charges, discounts handled
* Export invoices as **PDF (print-ready)**

### Inventory Management

* Track jewellery stock with SKU/HUID
* Auto-update inventory on sales
* Product image upload & local storage

### Customer Management

* Manage customer details
* Fast search and filtering
* Linked order history

### Orders & Estimates

* Create and convert estimates → invoices
* Track order lifecycle
* Advance payment support

### Desktop Experience

* Runs fully **offline (no internet required)**
* Local database storage (safe & fast)
* Native desktop UI (no browser)

### Auto Update System

* Detects new versions automatically
* One-click update inside app
* Secure update delivery via GitHub

---

## Tech Stack

| Layer       | Technology             |
| ----------- | ---------------------- |
| Frontend    | React + Vite           |
| Backend     | Django + DRF           |
| Desktop App | Electron               |
| Database    | SQLite (Local Storage) |
| PDF Engine  | Electron Print API     |

---

## Download & Install

👉 **Download Latest Version (One Click Install):**
🔗 [https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest](https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest)

### Installation Steps:

1. Download the `.exe` installer
2. Double-click to run installer
3. Choose installation location
4. Complete setup (Next → Install → Finish)
5. Launch JewelloSoft from Desktop shortcut

---

## Authentication

* Register a new account or login
* Secure local authentication
* Optional cloud sync (future support)

---

## Data Storage

All data is stored locally on your system:

```
C:\Users\<YourName>\AppData\Roaming\JewelloSoft\
```

Includes:

* Database (SQLite)
* Product images
* Generated invoices
* Logs

---

## PDF Invoice

* High-quality PDF generation
* Uses same React UI design
* Print or Save instantly

---

## Auto Updates

* App checks for updates automatically
* Shows "Update Available" notification
* One-click update installs latest version

---

## Development Setup (For Developers)

### Clone Repository

```bash
git clone https://github.com/SudeeptoBhakat/Jewellosoft.git
cd Jewellosoft
```

### Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Electron App

```bash
cd desktop
npm install
npm start
```

---

## Build Desktop App

```bash
cd desktop
npm run build
```

Output:

```
dist/JewelloSoft Setup.exe
```

---

## Important Notes

* This is a **production-ready desktop application**
* Works completely offline after installation
* No browser required
* Keep backups of your local data folder

---

## Roadmap (Future Updates)

* Cloud sync & backup
* Multi-user support
* Role-based access
* Advanced analytics dashboard
* Barcode scanning integration

---

## Author

**Sudeepto Bhakat**
Backend Developer
📧 [sudeeptabhakat84645@gmail.com](mailto:sudeeptabhakat84645@gmail.com)

---

## Support

If you like this project:

* ⭐ Star the repository
* 🐛 Report issues
* 💡 Suggest improvements

---

## License

This project is licensed under the MIT License.

---
