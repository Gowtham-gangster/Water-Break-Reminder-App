import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pauseflow.app',
  appName: 'PauseFlow',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'pauseflow_notification',
      iconColor: '#0284c7',
      sound: 'bell.wav'
    }
  }
};

export default config;
