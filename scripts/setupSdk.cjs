const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const sdkDir = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\P Gowtham\\AppData\\Local', 'Android', 'Sdk');
const cmdDir = path.join(sdkDir, 'cmdline-tools');
const zipFile = path.join(cmdDir, 'tools.zip');
const latestDir = path.join(cmdDir, 'latest');

fs.mkdirSync(cmdDir, { recursive: true });

function downloadTools() {
  if (fs.existsSync(path.join(latestDir, 'bin', 'sdkmanager.bat'))) {
    console.log('sdkmanager.bat already exists in latestDir');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (fs.existsSync(zipFile) && fs.statSync(zipFile).size > 100000000) {
      console.log('Zip file already downloaded:', zipFile);
      return resolve();
    }
    const url = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';
    console.log('Downloading from', url);
    const file = fs.createWriteStream(zipFile);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log('Downloaded. Size:', fs.statSync(zipFile).size);
          resolve();
        });
      });
    }).on('error', reject);
  });
}

async function extractTools() {
  if (fs.existsSync(path.join(latestDir, 'bin', 'sdkmanager.bat'))) {
    console.log('Already extracted!');
    return;
  }

  const tempExtract = path.join(cmdDir, 'temp');
  if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
  fs.mkdirSync(tempExtract, { recursive: true });

  console.log('Extracting archive...');
  execSync(`tar -xf "${zipFile}" -C "${tempExtract}"`);

  const extractedCmd = path.join(tempExtract, 'cmdline-tools');
  if (fs.existsSync(latestDir)) fs.rmSync(latestDir, { recursive: true, force: true });
  fs.renameSync(extractedCmd, latestDir);
  fs.rmSync(tempExtract, { recursive: true, force: true });
  if (fs.existsSync(zipFile)) fs.rmSync(zipFile, { force: true });

  console.log('Extracted to latest successfully!');
}

async function run() {
  await downloadTools();
  await extractTools();
  console.log('SDK tools setup completed at:', latestDir);
}

run().catch(console.error);
