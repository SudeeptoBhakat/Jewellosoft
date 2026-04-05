const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendExePath = path.join(__dirname, '../backend/dist/backend/backend.exe');

if (!fs.existsSync(backendExePath)) {
  console.log('\n[PREBUILD] Backend executable not found at: ' + backendExePath);
  console.log('[PREBUILD] Building it automatically using our highly-configured build_backend.py script...');
  try {
    const backendDir = path.join(__dirname, '../backend');
    // Orchestrate with the intelligent python script to fetch all Django subsystems safely
    execSync('python build_backend.py', { cwd: backendDir, stdio: 'inherit' });
    if (!fs.existsSync(backendExePath)) {
      console.error('\n[PREBUILD ERROR] Build script completed but backend.exe still not found!');
      process.exit(1);
    }
    console.log('[PREBUILD] Backend compiled successfully!\n');
  } catch (err) {
    console.error('\n[PREBUILD ERROR] Failed to build backend', err);
    process.exit(1);
  }
} else {
  console.log('\n[PREBUILD] Backend folder executable found. Proceeding with electron build.\n');
}
