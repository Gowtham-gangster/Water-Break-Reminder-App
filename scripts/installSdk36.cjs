const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const sdkDir = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\P Gowtham\\AppData\\Local', 'Android', 'Sdk');
const sdkManager = path.join(sdkDir, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');

console.log('Installing platforms;android-36 and build-tools;36.0.0...');
try {
  execSync(`"${sdkManager}" --sdk_root="${sdkDir}" "platforms;android-36"`, {
    stdio: 'inherit',
    env: { ...process.env, ANDROID_HOME: sdkDir, ANDROID_SDK_ROOT: sdkDir }
  });
  console.log('Android 36 platform installed successfully!');
} catch (e) {
  console.error('Error installing Android 36:', e.message);
}
