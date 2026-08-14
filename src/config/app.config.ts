// Central application configuration for EyeFlow Digital Wellness Assistant

export interface AppConfig {
  name: string;
  tagline: string;
  version: string;
  author: string;
  defaultWaterConfig: {
    enabled: boolean;
    startTime: string; // "08:00"
    endTime: string;   // "22:00"
    intervalMinutes: number; // 60
    durationMinutes: number; // 2
    sound: string; // "chime" | "gentle" | "water" | "none"
    quietHoursEnabled: boolean;
    quietStartTime: string; // "13:00"
    quietEndTime: string;   // "14:00"
  };
  defaultScreenBreakConfig: {
    enabled: boolean;
    startTime: string; // "09:00"
    endTime: string;   // "22:00"
    screenIntervalMinutes: number; // 30
    breakDurationMinutes: number;  // 5
    sound: string; // "gong" | "bell" | "soft" | "none"
  };
}

export const APP_CONFIG: AppConfig = {
  name: "EyeFlow",
  tagline: "Drink. Look Away. Feel Better.",
  version: "1.0.0",
  author: "EyeFlow Team",
  defaultWaterConfig: {
    enabled: true,
    startTime: "08:00",
    endTime: "22:00",
    intervalMinutes: 60,
    durationMinutes: 2,
    sound: "water",
    quietHoursEnabled: false,
    quietStartTime: "13:00",
    quietEndTime: "14:00",
  },
  defaultScreenBreakConfig: {
    enabled: true,
    startTime: "09:00",
    endTime: "22:00",
    screenIntervalMinutes: 30,
    breakDurationMinutes: 5,
    sound: "bell",
  },
};
