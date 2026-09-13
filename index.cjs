// Entry point for PauseFlow Desktop Application
const path = require('path');
const fs = require('fs');

try {
  require('./desktop/main.cjs');
} catch (err) {
  console.error('[PauseFlow Boot Failure]', err);
  try {
    const logPath = path.join(process.env.APPDATA || '', 'PauseFlow', 'boot_error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${err.stack || err}\n`);
  } catch (_) {}
}
