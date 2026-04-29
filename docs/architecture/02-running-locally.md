# Running Locally for Development

To develop and test JewelloSoft, you need to run the backend and the frontend separately before wrapping them in Electron. This prevents the need to constantly recompile the application during active development.

## Prerequisites
- **Python 3.10+** (Ensure it is added to your Windows PATH)
- **Node.js 18+** (For Vite and Electron)
- **Git Bash or PowerShell**

## 1. Starting the Django Backend

The backend must be running for the frontend to fetch data.

1. Open your terminal and navigate to the `backend` directory.
   ```bash
   cd backend
   ```

2. Activate the Python Virtual Environment.
   ```bash
   # On Windows
   source .venv/Scripts/activate
   ```

3. Run database migrations (only necessary if models were changed).
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

4. Start the Django development server.
   ```bash
   python manage.py runserver
   ```
   *The backend is now listening on `http://127.0.0.1:8000/`.*

## 2. Starting the React Frontend

Open a **new** terminal window (keep the backend running).

1. Navigate to the `frontend` directory.
   ```bash
   cd frontend
   ```

2. Install dependencies (if you haven't already).
   ```bash
   npm install
   ```

3. Start the Vite development server.
   ```bash
   npm run dev
   ```
   *The frontend is now available at `http://localhost:5173/`.* 
   *Note: Vite is configured to proxy API requests to port 8000 to avoid CORS issues during development.*

## 3. Testing the Electron Wrapper (Optional)

If you need to test desktop-specific features (like file system access or the backend spawning logic), you can run the Electron shell.

1. Open a **new** terminal window.
2. Navigate to the `desktop` directory.
   ```bash
   cd desktop
   ```
3. Install dependencies.
   ```bash
   npm install
   ```
4. Start Electron.
   ```bash
   npm start
   ```

> **Warning**: By default, the `desktop/main.js` file attempts to spawn `backend.exe`. If you have not built the backend yet, Electron will fail or throw errors. For pure UI/API development, stick to running the Vite dev server in your browser.
