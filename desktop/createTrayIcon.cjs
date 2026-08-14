// Generates an icon image for the Windows system tray
const fs = require('fs');
const path = require('path');

// 32x32 1-bit / 8-bit PNG buffer representing a calm eye/water icon
// Creating a minimal valid 16x16 PNG for the system tray
const iconPath = path.join(__dirname, 'trayIcon.png');

// 1x1 transparent PNG fallback buffer if needed
const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAALklEQVRYR+3XQQ0AIAwEwbT/p1kAB4g6sK2T7I9t9s/dDwAAAAAAAAAAAAAAAAAPGkY4A4G7o2LNAAAAAElFTkSuQmCC',
  'base64'
);

fs.writeFileSync(iconPath, png1x1);
console.log('Tray icon initialized at', iconPath);
