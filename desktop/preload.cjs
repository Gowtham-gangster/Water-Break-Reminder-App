// Electron Preload IPC Bridge for PauseFlow Native Desktop
const { contextBridge, ipcRenderer } = require('electron');

const nativeApi = {
  isDesktop: true,
  platform: process.platform,

  // Scheduler & Window IPC
  getSchedulerStatus: () => ipcRenderer.invoke('getSchedulerStatus'),
  updateWaterConfig: (config) => ipcRenderer.invoke('updateWaterConfig', config),
  updateScreenConfig: (config) => ipcRenderer.invoke('updateScreenConfig', config),
  pauseReminders: (minutes) => ipcRenderer.invoke('pauseReminders', minutes),
  resumeReminders: () => ipcRenderer.invoke('resumeReminders'),
  startPreview: (category, durationSec) =>
    ipcRenderer.invoke('startPreview', category, durationSec),
  completeReminder: (category, slotId) =>
    ipcRenderer.invoke('completeReminder', category, slotId),
  completeReminderItem: (type, slotId, isPreview) =>
    ipcRenderer.invoke('completeReminderItem', type, slotId, isPreview),
  skipReminder: (category, slotId) =>
    ipcRenderer.invoke('skipReminder', category, slotId),
  skipReminderItem: (type, slotId, isPreview) =>
    ipcRenderer.invoke('skipReminderItem', type, slotId, isPreview),
  resetTodayData: () => ipcRenderer.invoke('resetTodayData'),
  setStartWithWindows: (enable) => ipcRenderer.invoke('setStartWithWindows', enable),
  getStartWithWindows: () => ipcRenderer.invoke('getStartWithWindows'),
  minimizeToTray: () => ipcRenderer.invoke('minimizeToTray'),
  showMainWindow: () => ipcRenderer.invoke('showMainWindow'),
  closeReminderWindow: () => ipcRenderer.invoke('closeReminderWindow'),
  getReminderData: () => ipcRenderer.invoke('getReminderData'),
  getActiveReminders: () => ipcRenderer.invoke('getActiveReminders'),
  syncUserSchedule: (userId, schedule) => ipcRenderer.invoke('syncUserSchedule', userId, schedule),
  cancelUserSchedule: (userId) => ipcRenderer.invoke('cancelUserSchedule', userId),
  cancelAllReminders: () => ipcRenderer.invoke('cancelAllReminders'),

  // Event Listeners from Native Background
  onReminderTriggered: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('reminder-triggered', handler);
    return () => ipcRenderer.removeListener('reminder-triggered', handler);
  },
  onActiveRemindersUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('active-reminders-updated', handler);
    return () => ipcRenderer.removeListener('active-reminders-updated', handler);
  },
  onStatusUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('status-updated', handler);
    return () => ipcRenderer.removeListener('status-updated', handler);
  },
  onNotificationTap: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('notification-tap', handler);
    return () => ipcRenderer.removeListener('notification-tap', handler);
  },
  onNativeReminderCompleted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('native-reminder-completed', handler);
    return () => ipcRenderer.removeListener('native-reminder-completed', handler);
  },
  onNativeReminderExpired: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('native-reminder-expired', handler);
    return () => ipcRenderer.removeListener('native-reminder-expired', handler);
  },
  onNativePauseStateChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('onNativePauseStateChange', handler);
    return () => ipcRenderer.removeListener('onNativePauseStateChange', handler);
  },
};

contextBridge.exposeInMainWorld('pauseflowNative', nativeApi);
contextBridge.exposeInMainWorld('eyeflowNative', nativeApi);
