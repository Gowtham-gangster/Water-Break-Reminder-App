// Entry point for EyeFlow Desktop Application
const path = require('path');
const fs = require('fs');

try {
  require('./desktop/main.cjs');
} catch (err) {
  console.error('[EyeFlow Boot Failure]', err);
  try {
    const logPath = path.join(process.env.APPDATA || '', 'EyeFlow', 'boot_error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${err.stack || err}\n`);
  } catch (_) {}
}
