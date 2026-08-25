const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.join(__dirname, '..');
const distElectronDir = path.join(rootDir, 'dist-electron');
const releaseDir = path.join(rootDir, 'release');

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

console.log('====================================================');
console.log('       EyeFlow Production Release Bundler           ');
console.log('====================================================');

// 1. Copy NSIS Setup Installer
const setupCandidates = [
  path.join(distElectronDir, 'EyeFlow-Setup-1.0.0.exe'),
  path.join(distElectronDir, 'EyeFlow Setup 1.0.0.exe'),
];
let setupFound = false;
for (const setupExe of setupCandidates) {
  if (fs.existsSync(setupExe)) {
    const targetSetup = path.join(releaseDir, 'EyeFlow-Setup-1.0.0.exe');
    fs.copyFileSync(setupExe, targetSetup);
    const sizeMb = (fs.statSync(targetSetup).size / (1024 * 1024)).toFixed(2);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(targetSetup)).digest('hex');
    console.log(`[Release] Installer Created: release/EyeFlow-Setup-1.0.0.exe (${sizeMb} MB)`);
    console.log(`[Release] SHA256: ${sha256}`);
    setupFound = true;
    break;
  }
}
if (!setupFound) {
  console.warn('[Release] Warning: EyeFlow-Setup-1.0.0.exe not found in dist-electron');
}

// 2. Copy Portable ZIP
const zipCandidates = [
  path.join(distElectronDir, 'EyeFlow-1.0.0-win.zip'),
  path.join(distElectronDir, 'EyeFlow-1.0.0-win-x64.zip'),
  path.join(distElectronDir, 'EyeFlow 1.0.0.zip'),
];
let zipFound = false;
for (const zipFile of zipCandidates) {
  if (fs.existsSync(zipFile)) {
    const targetZip = path.join(releaseDir, 'EyeFlow-1.0.0-win-x64-portable.zip');
    fs.copyFileSync(zipFile, targetZip);
    const zipSizeMb = (fs.statSync(targetZip).size / (1024 * 1024)).toFixed(2);
    const zipSha256 = crypto.createHash('sha256').update(fs.readFileSync(targetZip)).digest('hex');
    console.log(`[Release] Portable ZIP Created: release/EyeFlow-1.0.0-win-x64-portable.zip (${zipSizeMb} MB)`);
    console.log(`[Release] SHA256: ${zipSha256}`);
    zipFound = true;
    break;
  }
}
if (!zipFound) {
  console.warn('[Release] Warning: Portable ZIP not found in dist-electron');
}

console.log('====================================================');
console.log('Final Release Artifacts in release/:');
for (const file of fs.readdirSync(releaseDir)) {
  const fullPath = path.join(releaseDir, file);
  const size = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2);
  console.log(` -> ${file} (${size} MB)`);
}
console.log('====================================================');
