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

    public static final String PREFS_SCHEDULED = "pauseflow_scheduled_alarms";
    public static final String KEY_SCHEDULED_LIST = "scheduled_list";
    public static final String PREFS_DELIVERED = "pauseflow_delivered_reminders";
    public static final String KEY_DELIVERED_LIST = "delivered_list";

    @Override
    public void load() {
        super.load();
        instanceRef = new WeakReference<>(this);
        Log.i(TAG, "[PauseFlow][Bridge] PauseFlowNativePlugin loaded. Bridge attached.");
        PauseFlowNotificationReceiver.ensureNotificationChannels(getContext());
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
            if (alarms == null) {
                call.reject("alarms parameter is required");
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

            long now = System.currentTimeMillis();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_SCHEDULED, Context.MODE_PRIVATE);
            JSONArray storedArray = new JSONArray();

            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", java.util.Locale.getDefault());
            String nowStr = sdf.format(new java.util.Date(now));

            int scheduledCount = 0;

            for (int i = 0; i < alarms.length(); i++) {
                JSONObject item = alarms.getJSONObject(i);
                String eventId = item.optString("eventId");
                String category = item.optString("category", "water");
                String userId = item.optString("userId", "");
                String title = item.optString("title", "");
                String body = item.optString("body", "");
                long scheduledTimestamp = item.optLong("scheduledTimestamp", 0);
                int durationSeconds = item.optInt("durationSeconds", 120);

                if (scheduledTimestamp > now + 1000) {
                    int requestCode = (eventId.hashCode() & 0x7fffffff);
                    String triggerStr = sdf.format(new java.util.Date(scheduledTimestamp));

                    Log.i(TAG, "[PauseFlow][TRACE] stage=ALARM_REGISTERED eventId=" + eventId + " triggerEpoch=" + scheduledTimestamp + " (" + triggerStr + ") requestCode=" + requestCode + " diffMs=" + (scheduledTimestamp - now));

                    Intent intent = new Intent(context, PauseFlowNotificationReceiver.class);
                    intent.setAction(PauseFlowNotificationReceiver.ACTION_REMINDER_ALARM);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_EVENT_ID, eventId);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_CATEGORY, category);
                    intent.putExtra(PauseFlowNotificationReceiver.EXTRA_USER_ID, userId);
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
            Log.i(TAG, "[PauseFlow][Delivery] Successfully scheduled " + scheduledCount + " native exact reminder alarms");

            JSObject ret = new JSObject();
            ret.put("scheduledCount", scheduledCount);
            ret.put("canScheduleExactAlarms", canSchedule);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "[PauseFlow][Delivery] scheduleExactReminderAlarms failed", e);
            call.reject("Failed to schedule native alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelExactReminderAlarms(PluginCall call) {
        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            SharedPreferences prefs = context.getSharedPreferences(PREFS_SCHEDULED, Context.MODE_PRIVATE);
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
                            Log.i(TAG, "[PauseFlow][TRACE] stage=ALARM_CANCELLED eventId=" + eventId + " reason=reschedule_or_clear");
                        }
                    }
                }
            }

            prefs.edit().remove(KEY_SCHEDULED_LIST).commit();
            Log.i(TAG, "[PauseFlow][Delivery] Cancelled all native exact reminder alarms");
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

            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_DELIVERED, Context.MODE_PRIVATE);
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
            Log.i(TAG, "[PauseFlow][Delivery] recordDeliveredReminder success eventId=" + eventId);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to record delivered reminder: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDeliveredReminders(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_DELIVERED, Context.MODE_PRIVATE);
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
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_DELIVERED, Context.MODE_PRIVATE);
            prefs.edit().remove(KEY_DELIVERED_LIST).commit();
            Log.i(TAG, "[PauseFlow][Delivery] clearDeliveredReminders success");
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
