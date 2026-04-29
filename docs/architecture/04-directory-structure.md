# Directory Structure

Understanding the layout of the repository is crucial for navigating and modifying the JewelloSoft codebase. The root repository is split into three main project folders.

## Root Level
- `backend/`: The Django REST API and SQLite database.
- `frontend/`: The React + Vite user interface.
- `desktop/`: The Electron wrapper and build scripts.
- `docs/`: Technical and User documentation.

---

## 1. The Backend (`/backend`)

The backend is built using Django. It handles all business logic, local data storage, and PDF generation calculations.

- **`apps/`**: Contains all the custom Django applications.
  - `accounts/`: Handles User models, JWT generation, and Shop Profile configuration.
  - `billing/`: Contains models for Estimates and Invoices, including the math logic for taxes and making charges.
  - `customers/`: Manages customer directories and ledger histories.
  - `inventory/`: Manages stock items, categories, and HUID tracking.
  - `rates/`: Handles the daily fluctuating Gold/Silver market rates.
  - `core/`: Contains base models and shared utilities.
- **`config/`**: The main Django project configuration.
  - `settings.py`: Database config, installed apps, and JWT settings.
  - `urls.py`: The root routing file that connects all the `apps/` endpoints to `/api/`.
- **`core/`**: Custom exceptions, pagination classes, and permission handlers for DRF.
- **`db.sqlite3`**: The local database file. (This is generated upon running migrations).
- **`manage.py`**: The standard Django execution script.
- **`run_waitress.py`**: A custom entry point used by PyInstaller to boot the Waitress server on Windows natively.
- **`backend.spec`**: The PyInstaller configuration file detailing hidden imports and data files required for compilation.

---

## 2. The Frontend (`/frontend`)

The frontend is a single-page application built with React and Vite.

- **`src/`**: The core source code directory.
  - **`assets/`**: Static files like CSS stylesheets (`pdf-standard.css`), SVG icons, and fonts.
  - **`components/`**: Reusable UI elements (Buttons, Modals, Inputs).
  - **`features/`**: The main logical blocks of the app, mirroring the backend (e.g., `billing/`, `inventory/`, `pdfs/`).
  - **`hooks/`**: Custom React hooks (e.g., `useAuth`, `useRates`).
  - **`services/`**: API wrapper classes that execute `fetch` calls to the Django backend.
  - **`App.jsx`**: The root routing component.
- **`index.html`**: The entry point for Vite.
- **`vite.config.js`**: Build configuration, including proxy settings to route `/api/` calls to Django during local development.

---

## 3. The Desktop Wrapper (`/desktop`)

This small folder is responsible for packaging the app into a Windows executable.

- **`main.js`**: The Electron entry point. It spawns the `backend.exe` child process, waits for a ping on port 8000, and then opens the Chromium window.
- **`package.json`**: Contains the Electron Builder configuration, defining the app icon, version, and which folders (frontend/dist and backend/dist) to include in the final installer.
