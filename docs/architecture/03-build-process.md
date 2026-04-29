# The Build Process

Packaging JewelloSoft into a single, distributable Windows executable (`.exe` installer) is a multi-step process. We must compile the backend, compile the frontend, and finally package everything together using Electron Builder.

## Step 1: Compiling the Backend (PyInstaller)

We use PyInstaller to freeze the Python environment, Django, and all dependencies into a standalone executable.

1. Open a terminal as Administrator.
2. Navigate to the `backend` directory and activate the virtual environment.
   ```bash
   cd backend
   source .venv/Scripts/activate
   ```
3. Run the custom build script.
   ```bash
   python build_backend.py
   ```
   *Alternatively, if running PyInstaller manually, ensure you use the `.spec` file so all hidden imports (like `apps.accounts.middleware`) are included:*
   ```bash
   pyinstaller backend.spec --clean
   ```
4. **Verification**: After a successful build, you will find `backend.exe` inside the `backend/dist/` folder.

## Step 2: Compiling the Frontend (Vite)

The React code needs to be transpiled into raw HTML/JS/CSS that Electron can serve natively.

1. Navigate to the `frontend` directory.
   ```bash
   cd frontend
   ```
2. Run the Vite build command.
   ```bash
   npm run build
   ```
3. **Verification**: This generates a `dist/` folder inside `frontend`. These are the static files Electron will load.

## Step 3: Packaging with Electron Builder

Now we bring the compiled backend and compiled frontend into the Electron wrapper to generate the final installer.

1. Navigate to the `desktop` directory.
   ```bash
   cd desktop
   ```
2. Ensure `package.json` is correctly configured. The `build` configuration must explicitly copy the `backend.exe` and the `frontend/dist` folders into the final app package.
   Example snippet from `package.json`:
   ```json
   "extraResources": [
     {
       "from": "../backend/dist/backend.exe",
       "to": "backend.exe"
     }
   ]
   ```
3. Run the Electron Builder command.
   ```bash
   npm run dist
   ```
   *(or `npm run build` depending on the exact script defined in package.json)*

4. **Final Output**: Electron Builder will generate a Setup executable (e.g., `JewelloSoft-Setup-1.0.0.exe`) in the `desktop/dist/` folder. This is the file you distribute to clients.
