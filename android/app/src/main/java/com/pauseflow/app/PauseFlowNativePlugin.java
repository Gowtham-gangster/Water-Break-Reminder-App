package com.pauseflow.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "PauseFlowNative")
public class PauseFlowNativePlugin extends Plugin {
    private static final String TAG = "PauseFlowNativePlugin";
    private static WeakReference<PauseFlowNativePlugin> instanceRef;

    public static final String LEGACY_PREFS_SCHEDULED = "pauseflow_scheduled_alarms";
    public static final String LEGACY_PREFS_DELIVERED = "pauseflow_delivered_reminders";
    public static final String PREFS_ACTIVE_USER = "pauseflow_active_session";
    public static final String KEY_ACTIVE_USER_ID = "active_user_id";
    public static final String KEY_SCHEDULED_LIST = "scheduled_list";
    public static final String KEY_DELIVERED_LIST = "delivered_list";

    public static String getScheduledPrefsName(String userId) {
        if (userId == null || userId.trim().isEmpty() || "default_user".equals(userId) || "local_user".equals(userId)) {
            return null;
        }
        return "pauseflow_user_" + userId.trim() + "_scheduled_alarms";
    }

    public static String getDeliveredPrefsName(String userId) {
        if (userId == null || userId.trim().isEmpty() || "default_user".equals(userId) || "local_user".equals(userId)) {
            return null;
        }
        return "pauseflow_user_" + userId.trim() + "_delivered_reminders";
    }

    @Override
    public void load() {
        super.load();
        instanceRef = new WeakReference<>(this);
        Log.i(TAG, "[PauseFlow][Bridge] PauseFlowNativePlugin loaded. Bridge attached.");
        PauseFlowNotificationReceiver.ensureNotificationChannels(getContext());
        cleanupLegacyGlobalPrefs(getContext());
    }

    public static void cleanupLegacyGlobalPrefs(Context context) {
        try {
            SharedPreferences legacySched = context.getSharedPreferences(LEGACY_PREFS_SCHEDULED, Context.MODE_PRIVATE);
            if (legacySched.contains(KEY_SCHEDULED_LIST)) {
                legacySched.edit().clear().commit();
                Log.i(TAG, "[PauseFlow][Cleanup] Cleared legacy global scheduled alarms");
            }
            SharedPreferences legacyDeliv = context.getSharedPreferences(LEGACY_PREFS_DELIVERED, Context.MODE_PRIVATE);
            if (legacyDeliv.contains(KEY_DELIVERED_LIST)) {
                legacyDeliv.edit().clear().commit();
                Log.i(TAG, "[PauseFlow][Cleanup] Cleared legacy global delivered reminders");
            }
        } catch (Exception e) {
            Log.w(TAG, "[PauseFlow][Cleanup] Legacy cleanup warning: " + e.getMessage());
        }
    }

    public static void notifyLiveReminderDelivered(
        final String eventId,
        final String category,
        final String userId,
        final long deliveredTimestamp,
        final long scheduledTimestamp,
        final int durationSeconds
    ) {
        Log.i(TAG, "[PauseFlow][TRACE] stage=BRIDGE_EMIT eventId=" + eventId + " category=" + category + " userId=" + userId);

        if (instanceRef != null) {
            final PauseFlowNativePlugin plugin = instanceRef.get();
            if (plugin != null) {
                try {
                    final JSObject data = new JSObject();
                    data.put("eventId", eventId);
                    data.put("category", category);
                    data.put("userId", userId);
                    data.put("timestamp", deliveredTimestamp);
                    data.put("scheduledTimestamp", scheduledTimestamp);
                    data.put("durationSeconds", durationSeconds);

                    if (plugin.getActivity() != null) {
                        plugin.getActivity().runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    plugin.notifyListeners("reminderDelivered", data, true);
                                    Log.i(TAG, "[PauseFlow][Bridge] emit_success (UI thread) eventId=" + eventId);
                                } catch (Exception ex) {
                                    Log.w(TAG, "[PauseFlow][Bridge] emit_failed on UI thread for " + eventId, ex);
                                }
                            }
                        });
                    } else {
                        plugin.notifyListeners("reminderDelivered", data, true);
                        Log.i(TAG, "[PauseFlow][Bridge] emit_success (non-UI) eventId=" + eventId);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "[PauseFlow][Bridge] emit_failed eventId=" + eventId, e);
                }
            } else {
                Log.w(TAG, "[PauseFlow][Bridge] emit_skipped (plugin instance collected/null) for " + eventId);
            }
        } else {
            Log.w(TAG, "[PauseFlow][Bridge] emit_skipped (instanceRef null, app process asleep/killed) for " + eventId);
        }
    }

    @PluginMethod
    public void scheduleExactReminderAlarms(PluginCall call) {
        try {
            JSArray alarms = call.getArray("alarms");
            String activeUserId = call.getString("userId", "");

            if (alarms == null) {
                call.reject("alarms parameter is required");
                return;
            }

            // CRITICAL AUTHENTICATION GUARD
            if (activeUserId == null || activeUserId.trim().isEmpty() || "default_user".equals(activeUserId) || "local_user".equals(activeUserId)) {
                Log.w(TAG, "[PauseFlow][SECURITY] stage=ANONYMOUS_SCHEDULER_BLOCKED reason=unauthenticated_user activeUserId=" + activeUserId);
                call.reject("Cannot schedule reminder alarms for unauthenticated or anonymous user");
                return;
            }

            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                call.reject("AlarmManager is unavailable");
                return;
            }

            boolean canSchedule = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                canSchedule = alarmManager.canScheduleExactAlarms();
            }
            Log.i(TAG, "[PauseFlow][TRACE] stage=PERMISSION_CHECK canScheduleExactAlarms=" + canSchedule);

            // Cancel any previously scheduled alarms for this user before scheduling new ones
            internalCancelAlarmsForUser(context, activeUserId);

            long now = System.currentTimeMillis();
            String userPrefsName = getScheduledPrefsName(activeUserId);
            SharedPreferences prefs = context.getSharedPreferences(userPrefsName, Context.MODE_PRIVATE);
            JSONArray storedArray = new JSONArray();

            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", java.util.Locale.getDefault());
            int scheduledCount = 0;

            for (int i = 0; i < alarms.length(); i++) {
                JSONObject item = alarms.getJSONObject(i);
                String eventId = item.optString("eventId");
                String category = item.optString("category", "water");
                String itemUserId = item.optString("userId", activeUserId);
                String title = item.optString("title", "");
                String body = item.optString("body", "");
                long scheduledTimestamp = item.optLong("scheduledTimestamp", 0);
                int durationSeconds = item.optInt("durationSeconds", 120);

                // Enforce that each alarm strictly matches the authenticated active user
                if (!activeUserId.equals(itemUserId)) {
                    Log.w(TAG, "[PauseFlow][SECURITY] stage=ANONYMOUS_SCHEDULER_BLOCKED reason=user_id_mismatch alarmUser=" + itemUserId + " activeUser=" + activeUserId);
                    continue;
                }

                if (scheduledTimestamp > now + 1000) {
                    int requestCode = (eventId.hashCode() & 0x7fffffff);
                    String triggerStr = sdf.format(new java.util.Date(scheduledTimestamp));

                    Log.i(TAG, "[PauseFlow][TRACE] stage=ALARM_REGISTERED eventId=" + eventId + " userId=" + activeUserId + " triggerEpoch=" + scheduledTimestamp + " (" + triggerStr + ") requestCode=" + requestCode);

                    Intent intent = new Intent(context, PauseFlowNotificationReceiver.class);
                    intent.setAction(PauseFlowNotificationReceiver.ACTION_REMINDER_ALARM);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_EVENT_ID, eventId);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_CATEGORY, category);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_USER_ID, activeUserId);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_TITLE, title);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_BODY, body);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_SCHEDULED_TIMESTAMP, scheduledTimestamp);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_DURATION_SECONDS, durationSeconds);

                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }
                    PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, scheduledTimestamp, pendingIntent);
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, scheduledTimestamp, pendingIntent);
                    }

                    storedArray.put(item);
                    scheduledCount++;
                }
            }

            prefs.edit().putString(KEY_SCHEDULED_LIST, storedArray.toString()).commit();

            // Record active user ID for boot receiver recovery
            context.getSharedPreferences(PREFS_ACTIVE_USER, Context.MODE_PRIVATE)
                   .edit()
                   .putString(KEY_ACTIVE_USER_ID, activeUserId)
                   .commit();

            Log.i(TAG, "[PauseFlow][Delivery] Successfully scheduled " + scheduledCount + " user-scoped exact reminder alarms for userId=" + activeUserId);

            JSObject ret = new JSObject();
            ret.put("scheduledCount", scheduledCount);
            ret.put("canScheduleExactAlarms", canSchedule);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "[PauseFlow][Delivery] scheduleExactReminderAlarms failed", e);
            call.reject("Failed to schedule native alarms: " + e.getMessage());
        }
    }

    private static void internalCancelAlarmsForUser(Context context, String userId) {
        if (userId == null || userId.isEmpty()) return;
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            String prefsName = getScheduledPrefsName(userId);
            if (prefsName == null) return;

            SharedPreferences prefs = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE);
            String json = prefs.getString(KEY_SCHEDULED_LIST, "[]");
            JSONArray array = new JSONArray(json);

            if (alarmManager != null) {
                for (int i = 0; i < array.length(); i++) {
                    JSONObject item = array.getJSONObject(i);
                    String eventId = item.optString("eventId");
                    if (!eventId.isEmpty()) {
                        Intent intent = new Intent(context, PauseFlowNotificationReceiver.class);
                        intent.setAction(PauseFlowNotificationReceiver.ACTION_REMINDER_ALARM);
                        int requestCode = (eventId.hashCode() & 0x7fffffff);
                        int flags = PendingIntent.FLAG_NO_CREATE;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            flags |= PendingIntent.FLAG_IMMUTABLE;
                        }
                        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags);
                        if (pendingIntent != null) {
                            alarmManager.cancel(pendingIntent);
                            pendingIntent.cancel();
                            Log.i(TAG, "[PauseFlow][TRACE] stage=ALARM_CANCELLED eventId=" + eventId + " userId=" + userId);
                        }

                        // Also cancel legacy showPendingIntent from earlier setAlarmClock calls
                        Intent showIntent = new Intent(context, MainActivity.class);
                        int showFlags = PendingIntent.FLAG_NO_CREATE;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            showFlags |= PendingIntent.FLAG_IMMUTABLE;
                        }
                        PendingIntent showPendingIntent = PendingIntent.getActivity(context, requestCode, showIntent, showFlags);
                        if (showPendingIntent != null) {
                            showPendingIntent.cancel();
                        }
                    }
                }
            }
            prefs.edit().remove(KEY_SCHEDULED_LIST).commit();
        } catch (Exception e) {
            Log.e(TAG, "[PauseFlow][Delivery] internalCancelAlarmsForUser error for userId=" + userId, e);
        }
    }

    @PluginMethod
    public void cancelExactReminderAlarms(PluginCall call) {
        try {
            Context context = getContext();
            String userId = call.getString("userId", "");

            if (userId != null && !userId.isEmpty() && !"default_user".equals(userId) && !"local_user".equals(userId)) {
                internalCancelAlarmsForUser(context, userId);
            } else {
                // If no specific userId, cancel for currently stored active user and legacy prefs
                SharedPreferences activePrefs = context.getSharedPreferences(PREFS_ACTIVE_USER, Context.MODE_PRIVATE);
                String storedActiveUser = activePrefs.getString(KEY_ACTIVE_USER_ID, "");
                if (!storedActiveUser.isEmpty()) {
                    internalCancelAlarmsForUser(context, storedActiveUser);
                    activePrefs.edit().remove(KEY_ACTIVE_USER_ID).commit();
                }
                cleanupLegacyGlobalPrefs(context);
            }

            Log.i(TAG, "[PauseFlow][Delivery] Cancelled native exact reminder alarms (userId=" + userId + ")");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "[PauseFlow][Delivery] cancelExactReminderAlarms failed", e);
            call.reject("Failed to cancel native alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkExactAlarmPermission(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                boolean canSchedule = alarmManager != null && alarmManager.canScheduleExactAlarms();
                ret.put("canScheduleExactAlarms", canSchedule);
                ret.put("isExactAlarmSupported", true);
                ret.put("sdkInt", Build.VERSION.SDK_INT);
            } else {
                ret.put("canScheduleExactAlarms", true);
                ret.put("isExactAlarmSupported", false);
                ret.put("sdkInt", Build.VERSION.SDK_INT);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("canScheduleExactAlarms", false);
            ret.put("isExactAlarmSupported", true);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open exact alarm settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkBatteryOptimization(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                boolean isIgnoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                ret.put("isIgnoringBatteryOptimizations", isIgnoring);
            } else {
                ret.put("isIgnoringBatteryOptimizations", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("isIgnoringBatteryOptimizations", true);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open battery optimization settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void recordDeliveredReminder(PluginCall call) {
        try {
            String eventId = call.getString("eventId", "");
            String category = call.getString("category", "water");
            String userId = call.getString("userId", "");
            long timestamp = call.getLong("timestamp", System.currentTimeMillis());
            long scheduledTimestamp = call.getLong("scheduledTimestamp", timestamp);

            if (userId == null || userId.isEmpty() || "default_user".equals(userId) || "local_user".equals(userId)) {
                Log.w(TAG, "[PauseFlow][SECURITY] stage=ANONYMOUS_SCHEDULER_BLOCKED reason=record_delivered_unauthenticated");
                call.reject("Cannot record delivery for unauthenticated user");
                return;
            }

            String prefsName = getDeliveredPrefsName(userId);
            SharedPreferences prefs = getContext().getSharedPreferences(prefsName, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(KEY_DELIVERED_LIST, "[]");
            JSONArray array = new JSONArray(existingJson);

            java.text.SimpleDateFormat isoFormat = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
            isoFormat.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.text.SimpleDateFormat dateFormat = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault());
            java.text.SimpleDateFormat timeFormat = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault());

            java.util.Date deliveredDate = new java.util.Date(timestamp);
            java.util.Date scheduledDate = new java.util.Date(scheduledTimestamp);

            JSONObject item = new JSONObject();
            item.put("eventId", eventId);
            item.put("type", category);
            item.put("category", category);
            item.put("userId", userId);
            item.put("date", dateFormat.format(scheduledDate));
            item.put("time", timeFormat.format(scheduledDate));
            item.put("scheduledAt", isoFormat.format(scheduledDate));
            item.put("deliveredAt", isoFormat.format(deliveredDate));
            item.put("status", "completed");
            item.put("timestamp", timestamp);
            item.put("scheduledTimestamp", scheduledTimestamp);
            array.put(item);

            prefs.edit().putString(KEY_DELIVERED_LIST, array.toString()).commit();
            Log.i(TAG, "[PauseFlow][Delivery] recordDeliveredReminder success eventId=" + eventId + " userId=" + userId);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to record delivered reminder: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeliveredReminders(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String userId = call.getString("userId", "");
            String prefsName = getDeliveredPrefsName(userId);
            
            if (prefsName == null) {
                // Anonymous or empty user has zero delivered reminders
                ret.put("deliveredReminders", new JSArray());
                call.resolve(ret);
                return;
            }

            SharedPreferences prefs = getContext().getSharedPreferences(prefsName, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(KEY_DELIVERED_LIST, "[]");
            JSONArray array = new JSONArray(existingJson);

            JSArray jsArray = new JSArray();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                JSObject jsObj = new JSObject();
                jsObj.put("eventId", obj.optString("eventId"));
                jsObj.put("category", obj.optString("category", obj.optString("type", "water")));
                jsObj.put("type", obj.optString("type", obj.optString("category", "water")));
                jsObj.put("userId", obj.optString("userId"));
                jsObj.put("date", obj.optString("date"));
                jsObj.put("time", obj.optString("time"));
                jsObj.put("scheduledAt", obj.optString("scheduledAt"));
                jsObj.put("deliveredAt", obj.optString("deliveredAt"));
                jsObj.put("status", obj.optString("status", "completed"));
                jsObj.put("timestamp", obj.optLong("timestamp"));
                jsObj.put("scheduledTimestamp", obj.optLong("scheduledTimestamp"));
                jsArray.put(jsObj);
            }

            ret.put("deliveredReminders", jsArray);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("deliveredReminders", new JSArray());
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void clearDeliveredReminders(PluginCall call) {
        try {
            String userId = call.getString("userId", "");
            String prefsName = getDeliveredPrefsName(userId);
            if (prefsName != null) {
                SharedPreferences prefs = getContext().getSharedPreferences(prefsName, Context.MODE_PRIVATE);
                prefs.edit().remove(KEY_DELIVERED_LIST).commit();
                Log.i(TAG, "[PauseFlow][Delivery] clearDeliveredReminders success for userId=" + userId);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear delivered reminders: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getNativeDiagnostics(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            ret.put("platform", "Android");
            ret.put("sdkInt", Build.VERSION.SDK_INT);
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("model", Build.MODEL);
            ret.put("packageName", getContext().getPackageName());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                ret.put("canScheduleExactAlarms", alarmManager != null && alarmManager.canScheduleExactAlarms());
            } else {
                ret.put("canScheduleExactAlarms", true);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                ret.put("isIgnoringBatteryOptimizations", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
            } else {
                ret.put("isIgnoringBatteryOptimizations", true);
            }

            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to retrieve native diagnostics: " + e.getMessage());
        }
    }
}

