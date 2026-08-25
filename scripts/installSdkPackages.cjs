const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const sdkDir = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\P Gowtham\\AppData\\Local', 'Android', 'Sdk');
const sdkManager = path.join(sdkDir, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');

console.log('Using sdkmanager at:', sdkManager);

// Accept licenses by creating license hashes directly in licenses folder
const licenseDir = path.join(sdkDir, 'licenses');
fs.mkdirSync(licenseDir, { recursive: true });

// Standard Android SDK license hashes
const androidSdkLicense = '24333f8a63b6825ea9c5514f83c2829b004d1fee\nd56f5187479451eabf01fb78af6dfcb131a6481e\n84831b9409646a53fe443e454032e7a5813a8479';
const androidSdkPreviewLicense = '84831b9409646a53fe443e454032e7a5813a8479';
const androidSdkArmLicense = '8566436534684972856';

fs.writeFileSync(path.join(licenseDir, 'android-sdk-license'), androidSdkLicense);
fs.writeFileSync(path.join(licenseDir, 'android-sdk-preview-license'), androidSdkPreviewLicense);
fs.writeFileSync(path.join(licenseDir, 'android-sdk-arm-dbt-license'), androidSdkArmLicense);

console.log('Licenses written.');

console.log('Installing platforms;android-34, build-tools;34.0.0, and platform-tools...');
try {
  execSync(`"${sdkManager}" --sdk_root="${sdkDir}" "platform-tools" "platforms;android-34" "build-tools;34.0.0"`, {
    stdio: 'inherit',
    env: { ...process.env, ANDROID_HOME: sdkDir, ANDROID_SDK_ROOT: sdkDir }
  });
  console.log('SDK packages installed successfully!');
} catch (e) {
  console.error('Error installing SDK packages:', e.message);
}
