// Electron Preload IPC Bridge for EyeFlow Native Desktop
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyeflowNative', {
  isDesktop: true,
  platform: process.platform,

  // Scheduler IPC
  getSchedulerStatus: () => ipcRenderer.invoke('getSchedulerStatus'),
  updateWaterConfig: (config) => ipcRenderer.invoke('updateWaterConfig', config),
  updateScreenConfig: (config) => ipcRenderer.invoke('updateScreenConfig', config),
  pauseReminders: (minutes) => ipcRenderer.invoke('pauseReminders', minutes),
  resumeReminders: () => ipcRenderer.invoke('resumeReminders'),
  startPreview: (category, durationSec) =>
    ipcRenderer.invoke('startPreview', category, durationSec),
  completeReminder: (category, slotId) =>
    ipcRenderer.invoke('completeReminder', category, slotId),
  resetTodayData: () => ipcRenderer.invoke('resetTodayData'),
  setStartWithWindows: (enable) => ipcRenderer.invoke('setStartWithWindows', enable),
  getStartWithWindows: () => ipcRenderer.invoke('getStartWithWindows'),
  minimizeToTray: () => ipcRenderer.invoke('minimizeToTray'),
  showMainWindow: () => ipcRenderer.invoke('showMainWindow'),

  // Event Listeners from Native Background
  onReminderTriggered: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('reminder-triggered', handler);
    return () => ipcRenderer.removeListener('reminder-triggered', handler);
  },
  onStatusUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('status-updated', handler);
    return () => ipcRenderer.removeListener('status-updated', handler);
  },
});
