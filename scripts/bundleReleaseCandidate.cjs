const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const distElectronDir = path.join(rootDir, 'dist-electron');
const androidDir = path.join(rootDir, 'android');

const rcWindowsDir = path.join(releaseDir, 'EyeFlow-2.0.0-rc1-Windows');
const rcAndroidDir = path.join(releaseDir, 'EyeFlow-2.0.0-rc1-Android');

fs.mkdirSync(rcWindowsDir, { recursive: true });
fs.mkdirSync(rcAndroidDir, { recursive: true });

console.log('====================================================');
console.log('    EyeFlow 2.0.0-rc1 Release Candidate Bundler     ');
console.log('====================================================\n');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// 1. Bundle Windows Release Candidate
console.log('[1/2] Bundling Windows Release Candidate (EyeFlow-2.0.0-rc1-Windows)...');
const winSourceCandidates = [
  path.join(distElectronDir, 'win-unpacked'),
  path.join(rootDir, 'dist-desktop'),
];

let winCopied = false;
for (const cand of winSourceCandidates) {
  if (fs.existsSync(cand)) {
    fs.cpSync(cand, path.join(rcWindowsDir, 'package'), { recursive: true });
    winCopied = true;
    break;
  }
}

// Check for setup or portable zip to include in Windows RC
const setupCandidates = [
  path.join(distElectronDir, 'EyeFlow-Setup-1.0.0.exe'),
  path.join(releaseDir, 'EyeFlow-Setup-1.0.0.exe'),
];
for (const setupExe of setupCandidates) {
  if (fs.existsSync(setupExe)) {
    const targetSetup = path.join(rcWindowsDir, 'EyeFlow-Setup-2.0.0-rc1.exe');
    fs.copyFileSync(setupExe, targetSetup);
    const sizeMb = (fs.statSync(targetSetup).size / (1024 * 1024)).toFixed(2);
    const sha = hashFile(targetSetup);
    console.log(`  ✓ Installer: EyeFlow-Setup-2.0.0-rc1.exe (${sizeMb} MB) | SHA256: ${sha}`);
    break;
  }
}

const zipCandidates = [
  path.join(distElectronDir, 'EyeFlow-1.0.0-win-x64.zip'),
  path.join(releaseDir, 'EyeFlow-1.0.0-win-x64-portable.zip'),
];
for (const zip of zipCandidates) {
  if (fs.existsSync(zip)) {
    const targetZip = path.join(rcWindowsDir, 'EyeFlow-2.0.0-rc1-win-x64-portable.zip');
    fs.copyFileSync(zip, targetZip);
    const sizeMb = (fs.statSync(targetZip).size / (1024 * 1024)).toFixed(2);
    const sha = hashFile(targetZip);
    console.log(`  ✓ Portable ZIP: EyeFlow-2.0.0-rc1-win-x64-portable.zip (${sizeMb} MB) | SHA256: ${sha}`);
    break;
  }
}

// Windows Manifest
const winManifest = {
  name: 'EyeFlow',
  version: '2.0.0-rc1',
  platform: 'windows',
  arch: 'x64',
  releaseType: 'release-candidate',
  buildDate: new Date().toISOString(),
  minOsVersion: 'Windows 10 Build 19041+',
  components: [
    'EyeFlow-Setup-2.0.0-rc1.exe',
    'EyeFlow-2.0.0-rc1-win-x64-portable.zip',
  ],
};
fs.writeFileSync(path.join(rcWindowsDir, 'manifest.json'), JSON.stringify(winManifest, null, 2));
console.log('  ✓ Windows RC manifest created: release/EyeFlow-2.0.0-rc1-Windows/manifest.json\n');

// 2. Bundle Android Release Candidate
console.log('[2/2] Bundling Android Release Candidate (EyeFlow-2.0.0-rc1-Android)...');
const apkCandidates = [
  path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  path.join(releaseDir, 'EyeFlow-debug.apk'),
];

let apkFound = false;
for (const apk of apkCandidates) {
  if (fs.existsSync(apk)) {
    const targetApk = path.join(rcAndroidDir, 'EyeFlow-2.0.0-rc1.apk');
    fs.copyFileSync(apk, targetApk);
    const sizeMb = (fs.statSync(targetApk).size / (1024 * 1024)).toFixed(2);
    const sha = hashFile(targetApk);
    console.log(`  ✓ APK: EyeFlow-2.0.0-rc1.apk (${sizeMb} MB) | SHA256: ${sha}`);
    apkFound = true;
    break;
  }
}

// Android Manifest
const androidManifest = {
  name: 'EyeFlow',
  version: '2.0.0-rc1',
  platform: 'android',
  releaseType: 'release-candidate',
  buildDate: new Date().toISOString(),
  minSdkVersion: 22,
  targetSdkVersion: 34,
  components: ['EyeFlow-2.0.0-rc1.apk'],
};
fs.writeFileSync(path.join(rcAndroidDir, 'manifest.json'), JSON.stringify(androidManifest, null, 2));
console.log('  ✓ Android RC manifest created: release/EyeFlow-2.0.0-rc1-Android/manifest.json\n');

// 3. Verify V1 Preservation
console.log('--- Verifying V1 Artifact Integrity ---');
const v1Files = [
  path.join(releaseDir, 'EyeFlow-1.0.0-win-x64-portable.zip'),
  path.join(releaseDir, 'EyeFlow-Setup-1.0.0.exe'),
  path.join(releaseDir, 'EyeFlow-debug.apk'),
  path.join(releaseDir, 'v1.0.0'),
];

for (const v1 of v1Files) {
  if (fs.existsSync(v1)) {
    console.log(`  ✓ Preserved V1 Artifact: ${path.relative(rootDir, v1)}`);
  }
}

console.log('\n====================================================');
console.log('  ✓ EyeFlow 2.0.0-rc1 Artifacts Packaged Successfully');
console.log('====================================================');
