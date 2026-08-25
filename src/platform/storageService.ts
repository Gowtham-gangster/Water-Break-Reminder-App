// Unified Storage Service Interface
import { storageEngine } from '../engine/storageEngine';
import type {
  WaterConfig,
  ScreenBreakConfig,
  GeneralSettings,
  NotificationSettings,
  PauseState,
  WaterReminderLog,
  ScreenBreakLog,
  UserAccount,
} from '../types';

export interface IStorageService {
  loadWaterConfig(): Promise<WaterConfig>;
  saveWaterConfig(cfg: WaterConfig): Promise<void>;
  loadScreenBreakConfig(): Promise<ScreenBreakConfig>;
  saveScreenBreakConfig(cfg: ScreenBreakConfig): Promise<void>;
  loadGeneralSettings(): Promise<GeneralSettings>;
  saveGeneralSettings(settings: GeneralSettings): Promise<void>;
  loadNotificationSettings(): Promise<NotificationSettings>;
  saveNotificationSettings(settings: NotificationSettings): Promise<void>;
  loadPauseState(): Promise<PauseState>;
  savePauseState(state: PauseState): Promise<void>;
  loadDailyWaterLogs(dateStr: string): Promise<WaterReminderLog[]>;
  saveDailyWaterLogs(dateStr: string, logs: WaterReminderLog[]): Promise<void>;
  loadDailyScreenLogs(dateStr: string): Promise<ScreenBreakLog[]>;
  saveDailyScreenLogs(dateStr: string, logs: ScreenBreakLog[]): Promise<void>;
  loadUserAccount(): Promise<UserAccount>;
  saveUserAccount(acc: UserAccount): Promise<void>;
  getOnboardingStatus(): Promise<boolean>;
  setOnboardingStatus(completed: boolean): Promise<void>;
}

export const storageService: IStorageService = storageEngine;
