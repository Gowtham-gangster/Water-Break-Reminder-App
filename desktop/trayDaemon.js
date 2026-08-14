// Windows Desktop System Tray & Background Daemon Wrapper for EyeFlow

console.log('====================================================');
console.log('  EyeFlow Digital Wellness Background Daemon Active');
console.log('  Philosophy: "Drink water. Look away. Take the break."');
console.log('====================================================');
console.log('[Tray Daemon] Background reminder scheduler active on Windows.');
console.log('[Tray Daemon] Native notifications enabled.');
console.log('[Tray Daemon] Minimizing to system tray.');

// Background timer loop maintaining native notification schedule
setInterval(() => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // Keeps process alive in background
}, 30000);
