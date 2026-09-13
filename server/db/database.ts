import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  DatabaseTables,
  UserEntity,
  UserSettingsEntity,
  WaterConfigurationEntity,
  LookOutsideConfigurationEntity,
  ReminderEventEntity,
  DeviceRegistrationEntity,
} from './schema';

export class Database {
  private dbPath: string;
  private data: DatabaseTables;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.resolve(process.cwd(), 'eyeflow_v2_dev.json');
    this.data = this.loadDatabase();
  }

  private getDefaultData(): DatabaseTables {
    return {
      users: [],
      user_settings: [],
      water_configurations: [],
      look_outside_configurations: [],
      reminder_events: [],
      device_registrations: [],
      password_resets: [],
      email_verifications: [],
    };
  }

  private loadDatabase(): DatabaseTables {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [],
          user_settings: parsed.user_settings || [],
          water_configurations: parsed.water_configurations || [],
          look_outside_configurations: parsed.look_outside_configurations || [],
          reminder_events: parsed.reminder_events || [],
          device_registrations: parsed.device_registrations || [],
          password_resets: parsed.password_resets || [],
          email_verifications: parsed.email_verifications || [],
        };
      }
    } catch (e) {
      console.warn('[Database] Could not read database file, initializing empty:', e);
    }
    return this.getDefaultData();
  }

  public save(): void {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[Database] Failed to write database file:', e);
    }
  }

  public generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  // --- Users Table ---
  public findUserByEmail(email: string): UserEntity | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): UserEntity | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public insertUser(user: UserEntity): UserEntity {
    this.data.users.push(user);
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<UserEntity>): UserEntity | undefined {
    const user = this.findUserById(id);
    if (!user) return undefined;
    Object.assign(user, updates, { updated_at: new Date().toISOString() });
    this.save();
    return user;
  }

  public deleteUser(id: string): boolean {
    const userIndex = this.data.users.findIndex((u) => u.id === id);
    if (userIndex === -1) return false;

    const user = this.data.users[userIndex];
    const userEmail = user.email.toLowerCase();

    // Cascading deletion across all tables
    this.data.users.splice(userIndex, 1);
    this.data.user_settings = this.data.user_settings.filter((s) => s.user_id !== id);
    this.data.water_configurations = this.data.water_configurations.filter((w) => w.user_id !== id);
    this.data.look_outside_configurations = this.data.look_outside_configurations.filter((l) => l.user_id !== id);
    this.data.reminder_events = this.data.reminder_events.filter((r) => r.user_id !== id);
    this.data.device_registrations = this.data.device_registrations.filter((d) => d.user_id !== id);
    this.data.password_resets = this.data.password_resets.filter((p) => p.email !== userEmail);
    this.data.email_verifications = this.data.email_verifications.filter((e) => e.email !== userEmail);

    this.save();
    return true;
  }

  // --- User Settings Table (Row-Level Security) ---
  public getSettingsByUserId(userId: string): UserSettingsEntity | undefined {
    return this.data.user_settings.find((s) => s.user_id === userId);
  }

  public upsertSettings(userId: string, updates: Partial<UserSettingsEntity>): UserSettingsEntity {
    let settings = this.getSettingsByUserId(userId);
    const now = new Date().toISOString();
    const updatedAt = updates.updated_at || now;
    const createdAt = updates.created_at || now;
    if (!settings) {
      settings = {
        id: this.generateId('set'),
        user_id: userId,
        theme: updates.theme || 'dark',
        time_format: updates.time_format || '24h',
        timezone: updates.timezone || 'UTC',
        sound_enabled: updates.sound_enabled ?? true,
        notifications_enabled: updates.notifications_enabled ?? true,
        water_sound: updates.water_sound || 'water',
        look_outside_sound: updates.look_outside_sound || 'bell',
        water_default_duration: updates.water_default_duration ?? 2,
        look_outside_default_duration: updates.look_outside_default_duration ?? 5,
        pause_until: updates.pause_until !== undefined ? updates.pause_until : null,
        pause_minutes: updates.pause_minutes !== undefined ? updates.pause_minutes : null,
        created_at: createdAt,
        updated_at: updatedAt,
      };
      this.data.user_settings.push(settings);
    } else {
      Object.assign(settings, updates, { updated_at: updatedAt });
    }
    this.save();
    return settings;
  }

  // --- Water Configurations Table ---
  public getWaterConfigByUserId(userId: string): WaterConfigurationEntity | undefined {
    return this.data.water_configurations.find((w) => w.user_id === userId);
  }

  public upsertWaterConfig(
    userId: string,
    updates: Partial<WaterConfigurationEntity>
  ): WaterConfigurationEntity {
    let config = this.getWaterConfigByUserId(userId);
    const now = new Date().toISOString();
    const updatedAt = updates.updated_at || now;
    const createdAt = updates.created_at || now;
    if (!config) {
      config = {
        id: this.generateId('wtr'),
        user_id: userId,
        enabled: updates.enabled ?? true,
        interval_minutes: updates.interval_minutes ?? 45,
        start_time: updates.start_time ?? '09:00',
        end_time: updates.end_time ?? '18:00',
        duration_seconds: updates.duration_seconds ?? 120,
        active_days: updates.active_days ?? [1, 2, 3, 4, 5],
        created_at: createdAt,
        updated_at: updatedAt,
      };
      this.data.water_configurations.push(config);
    } else {
      Object.assign(config, updates, { updated_at: updatedAt });
    }
    this.save();
    return config;
  }

  // --- Look Outside Configurations Table ---
  public getLookOutsideConfigByUserId(userId: string): LookOutsideConfigurationEntity | undefined {
    return this.data.look_outside_configurations.find((l) => l.user_id === userId);
  }

  public upsertLookOutsideConfig(
    userId: string,
    updates: Partial<LookOutsideConfigurationEntity>
  ): LookOutsideConfigurationEntity {
    let config = this.getLookOutsideConfigByUserId(userId);
    const now = new Date().toISOString();
    const updatedAt = updates.updated_at || now;
    const createdAt = updates.created_at || now;
    if (!config) {
      config = {
        id: this.generateId('scr'),
        user_id: userId,
        enabled: updates.enabled ?? true,
        interval_minutes: updates.interval_minutes ?? 20,
        start_time: updates.start_time ?? '09:00',
        end_time: updates.end_time ?? '18:00',
        duration_seconds: updates.duration_seconds ?? 300,
        active_days: updates.active_days ?? [1, 2, 3, 4, 5],
        created_at: createdAt,
        updated_at: updatedAt,
      };
      this.data.look_outside_configurations.push(config);
    } else {
      Object.assign(config, updates, { updated_at: updatedAt });
    }
    this.save();
    return config;
  }

  // --- Reminder Events Table (Row-Level Security) ---
  public getReminderEvents(userId: string, limit = 100): ReminderEventEntity[] {
    return this.data.reminder_events
      .filter((r) => r.user_id === userId)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      .slice(0, limit);
  }

  public getReminderEventById(id: string, userId: string): ReminderEventEntity | undefined {
    return this.data.reminder_events.find((r) => r.id === id && r.user_id === userId);
  }

  public insertReminderEvent(
    userId: string,
    event: Omit<ReminderEventEntity, 'user_id' | 'created_at' | 'updated_at'> & {
      id?: string;
      created_at?: string;
      updated_at?: string;
    }
  ): ReminderEventEntity {
    // 1. Check for existing event by exact ID
    if (event.id) {
      const existing = this.data.reminder_events.find(
        (r) => r.id === event.id && r.user_id === userId
      );
      if (existing) {
        if (event.status && event.status !== existing.status) {
          existing.status = event.status;
          if (event.completed_at) existing.completed_at = event.completed_at;
          existing.updated_at = new Date().toISOString();
          this.save();
        }
        return existing;
      }
    }

    // 2. Check for duplicate occurrence by composite key (userId + scheduled_at + type)
    const duplicateOccurrence = this.data.reminder_events.find(
      (r) =>
        r.user_id === userId &&
        r.scheduled_at === event.scheduled_at &&
        r.type === event.type
    );
    if (duplicateOccurrence) {
      if (event.status && event.status !== duplicateOccurrence.status) {
        duplicateOccurrence.status = event.status;
        if (event.completed_at) duplicateOccurrence.completed_at = event.completed_at;
        duplicateOccurrence.updated_at = new Date().toISOString();
        this.save();
      }
      return duplicateOccurrence;
    }

    const now = new Date().toISOString();
    const newEvent: ReminderEventEntity = {
      id: event.id || this.generateId('ev'),
      user_id: userId,
      type: event.type,
      scheduled_at: event.scheduled_at,
      started_at: event.started_at || null,
      completed_at: event.completed_at || null,
      status: event.status || 'completed',
      created_at: event.created_at || now,
      updated_at: event.updated_at || now,
    };
    this.data.reminder_events.push(newEvent);
    this.save();
    return newEvent;
  }

  public updateReminderEvent(
    id: string,
    userId: string,
    updates: Partial<ReminderEventEntity>
  ): ReminderEventEntity | undefined {
    const event = this.getReminderEventById(id, userId);
    if (!event) return undefined;
    Object.assign(event, updates, { updated_at: new Date().toISOString() });
    this.save();
    return event;
  }

  // --- User-Specific Statistics & Analytics ---
  public getUserStatistics(userId: string): {
    waterCompleted: number;
    waterMissed: number;
    screenCompleted: number;
    screenMissed: number;
    dailyCompletionRate: number;
    weeklyCompletionRate: number;
    currentStreak: number;
    bestStreak: number;
    totalWaterReminders: number;
    totalScreenBreaks: number;
    monthlyTrends: Array<{
      date: string;
      waterCompleted: number;
      waterMissed: number;
      screenCompleted: number;
      screenMissed: number;
      completionRate: number;
    }>;
    today: {
      waterCompleted: number;
      waterScheduled: number;
      screenCompleted: number;
      screenScheduled: number;
    };
  } {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    const userEvents = this.data.reminder_events.filter((r) => r.user_id === userId);

    const waterEvents = userEvents.filter((r) => r.type === 'water' || r.type === 'both');
    const screenEvents = userEvents.filter(
      (r) => r.type === 'screen' || r.type === 'look_outside' || r.type === 'both'
    );

    const waterCompleted = waterEvents.filter((r) => r.status === 'completed').length;
    const waterMissed = waterEvents.filter(
      (r) => r.status === 'missed' || r.status === 'expired' || r.status === 'skipped'
    ).length;

    const screenCompleted = screenEvents.filter((r) => r.status === 'completed').length;
    const screenMissed = screenEvents.filter(
      (r) => r.status === 'missed' || r.status === 'expired' || r.status === 'skipped'
    ).length;

    // Today's progress
    const todayEvents = userEvents.filter((r) => r.scheduled_at.startsWith(todayStr));
    const todayWater = todayEvents.filter((r) => r.type === 'water' || r.type === 'both');
    const todayScreen = todayEvents.filter(
      (r) => r.type === 'screen' || r.type === 'look_outside' || r.type === 'both'
    );

    const todayWaterCompleted = todayWater.filter((r) => r.status === 'completed').length;
    const todayScreenCompleted = todayScreen.filter((r) => r.status === 'completed').length;

    const dailyCompletionRate =
      todayEvents.length > 0
        ? Math.round(
            ((todayWaterCompleted + todayScreenCompleted) / todayEvents.length) * 100
          )
        : 0;

    // Weekly completion rate (past 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekEvents = userEvents.filter(
      (r) => new Date(r.scheduled_at).getTime() >= sevenDaysAgo
    );
    const weekCompleted = weekEvents.filter((r) => r.status === 'completed').length;
    const weeklyCompletionRate =
      weekEvents.length > 0 ? Math.round((weekCompleted / weekEvents.length) * 100) : 0;

    // Streak calculation (consecutive calendar days with completed events)
    const completedDaysSet = new Set<string>();
    for (const ev of userEvents) {
      if (ev.status === 'completed') {
        const d = ev.scheduled_at.substring(0, 10);
        completedDaysSet.add(d);
      }
    }

    const sortedDays = Array.from(completedDaysSet).sort();
    let bestStreak = 0;
    let currentStreak = 0;

    if (sortedDays.length > 0) {
      let tempStreak = 0;
      let prevDate: Date | null = null;

      for (const dayStr of sortedDays) {
        const curDate = new Date(`${dayStr}T00:00:00`);
        if (!prevDate) {
          tempStreak = 1;
        } else {
          const diffDays = Math.round(
            (curDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)
          );
          if (diffDays === 1) {
            tempStreak++;
          } else if (diffDays > 1) {
            tempStreak = 1;
          }
        }
        if (tempStreak > bestStreak) bestStreak = tempStreak;
        prevDate = curDate;
      }

      // Check if current streak extends to today or yesterday
      const lastCompletedDate = new Date(`${sortedDays[sortedDays.length - 1]}T00:00:00`);
      const todayDate = new Date(`${todayStr}T00:00:00`);
      const diffFromToday = Math.round(
        (todayDate.getTime() - lastCompletedDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (diffFromToday <= 1) {
        currentStreak = tempStreak;
      } else {
        currentStreak = 0;
      }
    }

    // Monthly trends (day-by-day for the current month)
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const monthlyTrends: Array<{
      date: string;
      waterCompleted: number;
      waterMissed: number;
      screenCompleted: number;
      screenMissed: number;
      completionRate: number;
    }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      const dayEvents = userEvents.filter((r) => r.scheduled_at.startsWith(dayStr));

      const wComp = dayEvents.filter(
        (r) => (r.type === 'water' || r.type === 'both') && r.status === 'completed'
      ).length;
      const wMiss = dayEvents.filter(
        (r) =>
          (r.type === 'water' || r.type === 'both') &&
          (r.status === 'missed' || r.status === 'expired' || r.status === 'skipped')
      ).length;

      const sComp = dayEvents.filter(
        (r) =>
          (r.type === 'screen' || r.type === 'look_outside' || r.type === 'both') &&
          r.status === 'completed'
      ).length;
      const sMiss = dayEvents.filter(
        (r) =>
          (r.type === 'screen' || r.type === 'look_outside' || r.type === 'both') &&
          (r.status === 'missed' || r.status === 'expired' || r.status === 'skipped')
      ).length;

      const total = dayEvents.length;
      const compRate = total > 0 ? Math.round(((wComp + sComp) / total) * 100) : 0;

      monthlyTrends.push({
        date: dayStr,
        waterCompleted: wComp,
        waterMissed: wMiss,
        screenCompleted: sComp,
        screenMissed: sMiss,
        completionRate: compRate,
      });
    }

    return {
      waterCompleted,
      waterMissed,
      screenCompleted,
      screenMissed,
      dailyCompletionRate,
      weeklyCompletionRate,
      currentStreak,
      bestStreak,
      totalWaterReminders: waterEvents.length,
      totalScreenBreaks: screenEvents.length,
      monthlyTrends,
      today: {
        waterCompleted: todayWaterCompleted,
        waterScheduled: todayWater.length,
        screenCompleted: todayScreenCompleted,
        screenScheduled: todayScreen.length,
      },
    };
  }

  // --- User-Specific Paginated History Query ---
  public getUserHistory(
    userId: string,
    options: {
      range?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ): {
    events: ReminderEventEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const now = new Date();

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(yesterday.getDate()).padStart(2, '0')}`;

    // Compute start of week (Monday)
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    const startOfWeekStr = `${startOfWeek.getFullYear()}-${String(
      startOfWeek.getMonth() + 1
    ).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;

    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    let filtered = this.data.reminder_events
      .filter((r) => r.user_id === userId)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

    // Apply Range Filter
    if (options.range === 'today') {
      filtered = filtered.filter((r) => r.scheduled_at.startsWith(todayStr));
    } else if (options.range === 'yesterday') {
      filtered = filtered.filter((r) => r.scheduled_at.startsWith(yesterdayStr));
    } else if (options.range === 'this_week') {
      filtered = filtered.filter((r) => r.scheduled_at >= startOfWeekStr);
    } else if (options.range === 'this_month') {
      filtered = filtered.filter((r) => r.scheduled_at >= startOfMonthStr);
    } else if (options.startDate || options.endDate) {
      if (options.startDate) {
        filtered = filtered.filter((r) => r.scheduled_at >= options.startDate!);
      }
      if (options.endDate) {
        filtered = filtered.filter((r) => r.scheduled_at <= options.endDate!);
      }
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const events = filtered.slice(offset, offset + limit);

    return {
      events,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // --- Device Registrations Table ---
  public getDevicesByUserId(userId: string): DeviceRegistrationEntity[] {
    return this.data.device_registrations.filter((d) => d.user_id === userId);
  }

  public registerDevice(
    userId: string,
    device: { device_id: string; platform: 'windows' | 'android' | 'web'; device_name: string }
  ): DeviceRegistrationEntity {
    const now = new Date().toISOString();
    let reg = this.data.device_registrations.find(
      (d) => d.user_id === userId && d.device_id === device.device_id
    );
    if (reg) {
      reg.platform = device.platform;
      reg.device_name = device.device_name;
      reg.last_sync_at = now;
      reg.updated_at = now;
    } else {
      reg = {
        id: this.generateId('dev'),
        user_id: userId,
        device_id: device.device_id,
        platform: device.platform,
        device_name: device.device_name,
        last_sync_at: now,
        created_at: now,
        updated_at: now,
      };
      this.data.device_registrations.push(reg);
    }
    this.save();
    return reg;
  }

  // --- Password Reset Table ---
  public createPasswordReset(email: string, expiresInMinutes = 15): { id: string; token: string; expires_at: string } {
    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();
    const reset = {
      id: this.generateId('rst'),
      email: email.toLowerCase(),
      token,
      expires_at: expiresAt,
      used: false,
      created_at: now.toISOString(),
    };
    this.data.password_resets.push(reset);
    this.save();
    return reset;
  }

  public getValidPasswordReset(token: string): { id: string; email: string } | null {
    const now = new Date().toISOString();
    const reset = this.data.password_resets.find(
      (r) => r.token === token && !r.used && r.expires_at > now
    );
    return reset ? { id: reset.id, email: reset.email } : null;
  }

  public markPasswordResetUsed(id: string): void {
    const reset = this.data.password_resets.find((r) => r.id === id);
    if (reset) {
      reset.used = true;
      this.save();
    }
  }

  // --- Email Verification Table ---
  public createEmailVerification(email: string, expiresInMinutes = 30): { id: string; code: string } {
    // 6-digit numeric verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();
    const entry = {
      id: this.generateId('vrf'),
      email: email.toLowerCase(),
      code,
      verified: false,
      expires_at: expiresAt,
      created_at: now.toISOString(),
    };
    this.data.email_verifications.push(entry);
    this.save();
    return { id: entry.id, code: entry.code };
  }

  public verifyEmailCode(email: string, code: string): boolean {
    const now = new Date().toISOString();
    const entry = this.data.email_verifications.find(
      (e) => e.email === email.toLowerCase() && e.code === code && !e.verified && e.expires_at > now
    );
    if (entry) {
      entry.verified = true;
      this.save();
      return true;
    }
    return false;
  }
}

export const db = new Database();
