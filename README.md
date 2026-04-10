# JewelloSoft – Production-Grade Jewellery Retail & Billing System

JewelloSoft is a **modern, offline-first desktop application** meticulously engineered for jewellery shop owners. It provides a robust, seamless, and professional environment to manage **billing, inventory, customers, and orders**. 

Designed with an enterprise-grade stack (**Electron + React + Django**), it delivers **high performance, offline local data availability**, and resilient **background cloud synchronization**.

---

## 🚀 Core Features

### 💎 Advanced Billing & Invoicing
* Instantly generate professional, print-ready PDF invoices.
* Automated calculating engine accommodating Making Charges, Discounts, and live Gold/Silver hallmark rates.
* Complex GST (CGST/SGST/IGST) calculations mapped dynamically.

### 📦 Precision Inventory Management
* Track and manage jewellery stock using HUID and SKU logic.
* High-resolution product image upload and local unified storage.
* Automated dynamic stock deduction upon invoice generation.

### 👥 Customer Relationship Management
* Comprehensive database for customer tracking.
* Fast indexing, advanced filtering, and rich search.
* 360-degree linked order and billing history.

### ☁️ Offline-First Security & Cloud Sync
* **Works 100% Offline**: Continuous operation even during internet outages using local SQLite storage.
* **Background Data Synchronization**: A silent daemon natively syncs customer and shop configuration back to a secure Supabase cloud layer upon internet reconnection.
* **Secure Auth Bridging**: Highly secure local encryption and Supabase JWT integrated profile logic, employing a true Singleton tenant structure per device to prevent data leaks.

### 🔄 CI/CD & Auto Update Pipeline
* Implemented with **electron-updater** tracking GitHub Releases.
* Automatically detects, downloads, and prompts for new NSIS version installations directly inside the UI.

---

## 🏗 Technology Stack

| Layer                         | Technology                      |
| ----------------------------- | ------------------------------- |
| **Frontend Framework**        | React + Vite                    |
| **Backend API Layer**         | Python Django + Django REST (DRF)|
| **Production WSGI Server**    | Waitress (Bundled via PyInstaller)|
| **Desktop Orchestration**     | Electron.js                     |
| **Local Offline Database**    | SQLite                          |
| **Cloud Authentication/Sync** | Supabase                        |

---

## 📥 Download & Install

👉 **Download the Latest Production Release (v1.0.1):**  
🔗 [Download Latest JewelloSoft Setup.exe](https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest)

### Installation Guide:
1. Download the `.exe` installer locally.
2. Run the installer and provide administrator privileges if prompted.
3. Advance through the configuration setup.
4. Launch JewelloSoft natively from your Desktop shortcut!

---

## 🛡️ Architecture & Security Details

* **Django Standalone Bundle**: The Python backend is entirely independent and dependency-free, shipped as a frozen executable using PyInstaller.
* **Encrypted Licensing**: Offline license keys are validated using AES/Fernet cryptography.
* **Separation of Concerns**: UI runs solely on React/Electron processes, routing requests to the hidden background WSGI local server.

---

## 💻 Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/SudeeptoBhakat/Jewellosoft.git
cd Jewellosoft
```

### 2. Backend Initialization (Django)
Requires Python 3.10+
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# Install requirements
pip install -r requirements.txt
# Migrate Schema
python manage.py migrate
# Seed Database & Run Server
python manage.py runserver
```

### 3. Frontend Initialization (React)
Requires Node.js 18+
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

## 📦 Building for Production

JewelloSoft uses GitHub Actions for continuous delivery. To build locally:
```bash
# Compile Frontend Production Build
cd frontend
npm run build

# Compile Python Backend Binary (Windows)
cd backend
python build_backend.py 

# Build Electron NSIS Installer
cd desktop
npm run build
```
Output artifact available at: `desktop/dist/JewelloSoft Setup.exe`

---

## 🗺 Roadmap

* Advanced multi-location branch syncing.
* Enhanced Barcode/QR Code scanning integration.
* Daily market price rate integration feeds.
* Role-based access control (RBAC) for multiple staff logins.

---

## 👤 Author
**Sudeepto Bhakat**  
Lead Backend Engineer & Systems Architect  
📧 [sudeeptabhakat84645@gmail.com](mailto:sudeeptabhakat84645@gmail.com)

---

## 📜 License
This project is securely licensed under the MIT License.
