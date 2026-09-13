import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eyeflow.app',
  appName: 'PauseFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_eyeflow',
      iconColor: '#0284c7',
      sound: 'bell.wav'
    }
  }
};

export default config;
