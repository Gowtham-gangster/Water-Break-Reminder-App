const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('========================================');
console.log('  PAUSEFLOW ANDROID BUILD PIPELINE      ');
console.log('========================================');

const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');
const releaseDir = path.join(rootDir, 'releases', 'android');
const gradleBat = path.join(androidDir, 'gradlew.bat');

fs.mkdirSync(releaseDir, { recursive: true });

// 1. Build Vite frontend
console.log('\n[1/4] Building production React/Vite assets...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Sync to Android project via Capacitor
console.log('\n[2/4] Syncing assets & plugins with Capacitor Android...');
execSync('npx cap sync android', { cwd: rootDir, stdio: 'inherit' });

// 3. Clean & Assemble Release APK with Gradle
console.log('\n[3/4] Compiling Android Release APK (gradlew clean assembleRelease)...');
const sdkDir = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\P Gowtham\\AppData\\Local', 'Android', 'Sdk');
execSync(`"${gradleBat}" clean assembleRelease`, {
  cwd: androidDir,
  stdio: 'inherit',
  env: { ...process.env, ANDROID_HOME: sdkDir, ANDROID_SDK_ROOT: sdkDir }
});

// 4. Copy APK to releases/android/PauseFlow.apk
const outputReleaseApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outputReleaseUnsignedApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
const outputDebugApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

const outputApk = fs.existsSync(outputReleaseApk)
  ? outputReleaseApk
  : fs.existsSync(outputReleaseUnsignedApk)
  ? outputReleaseUnsignedApk
  : outputDebugApk;

const targetApk = path.join(releaseDir, 'PauseFlow.apk');

if (fs.existsSync(outputApk)) {
  fs.copyFileSync(outputApk, targetApk);

  const stat = fs.statSync(targetApk);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  const fileBuffer = fs.readFileSync(targetApk);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  console.log('\n[4/4] PauseFlow Android Release APK generated successfully!');
  console.log('----------------------------------------');
  console.log(`Source:   ${outputApk}`);
  console.log(`Artifact: releases/android/PauseFlow.apk`);
  console.log(`Size:     ${sizeMb} MB (${stat.size} bytes)`);
  console.log(`SHA256:   ${sha256}`);
  console.log('----------------------------------------');
} else {
  console.error('Error: output APK not found at', outputApk);
  process.exit(1);
}
