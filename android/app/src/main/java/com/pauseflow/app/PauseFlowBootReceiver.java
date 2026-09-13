package com.pauseflow.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * PauseFlowBootReceiver
 * Restores scheduled exact alarms when device boots or package is updated.
 */
public class PauseFlowBootReceiver extends BroadcastReceiver {
    private static final String TAG = "PauseFlowBootReceiver";
    public static final String PREFS_SCHEDULED = "pauseflow_scheduled_alarms";
    public static final String KEY_SCHEDULED_LIST = "scheduled_list";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.i(TAG, "Boot/Package action received: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action)) {
            
            final PendingResult pendingResult = goAsync();
            android.os.PowerManager powerManager = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
            android.os.PowerManager.WakeLock wakeLock = null;
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "PauseFlow:BootReceiverWakeLock");
                wakeLock.acquire(15000); // 15 seconds safety timeout
            }

            try {
                restoreScheduledAlarms(context);
            } finally {
                if (wakeLock != null && wakeLock.isHeld()) {
                    try {
                        wakeLock.release();
                    } catch (Exception ignored) {}
                }
                if (pendingResult != null) {
                    pendingResult.finish();
                }
            }
        }
    }

    public static void restoreScheduledAlarms(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_SCHEDULED, Context.MODE_PRIVATE);
            String json = prefs.getString(KEY_SCHEDULED_LIST, "[]");
            JSONArray array = new JSONArray(json);
            long now = System.currentTimeMillis();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            JSONArray remaining = new JSONArray();

            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.getJSONObject(i);
                long scheduledTimestamp = item.optLong("scheduledTimestamp", 0);
                String eventId = item.optString("eventId", "");
                String category = item.optString("category", "water");
                String userId = item.optString("userId", "");
                String title = item.optString("title", "");
                String body = item.optString("body", "");
                int durationSeconds = item.optInt("durationSeconds", 120);

                if (scheduledTimestamp > now + 1000) {
                    Intent alarmIntent = new Intent(context, PauseFlowNotificationReceiver.class);
                    alarmIntent.setAction(PauseFlowNotificationReceiver.ACTION_REMINDER_ALARM);
                    alarmIntent.putExtra(PauseFlowNotificationReceiver.EXTRA_EVENT_ID, eventId);
                    alarmIntent.putExtra(PauseFlowNotificationReceiver.EXTRA_CATEGORY, category);
                    alarmIntent.putExtra(PauseFlowNotificationReceiver.EXTRA_USER_ID, userId);
                    alarmIntent.putExtra(PauseFlowNotificationReceiver.EXTRA_TITLE, title);
                    alarmIntent.putExtra(PauseFlowNotificationReceiver.EXTRA_BODY, body);
                    alarmIntent.putExtra(PauseFlowNotificationReceiver.EXTRA_SCHEDULED_TIMESTAMP, scheduledTimestamp);
                    alarmIntent.putExtra(PauseFlowNotificationReceiver.EXTRA_DURATION_SECONDS, durationSeconds);

                    int requestCode = (eventId.hashCode() & 0x7fffffff);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }
                    PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, alarmIntent, flags);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, scheduledTimestamp, pendingIntent);
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, scheduledTimestamp, pendingIntent);
                    }
                    remaining.put(item);
                }
            }

            prefs.edit().putString(KEY_SCHEDULED_LIST, remaining.toString()).commit();
            Log.i(TAG, "Restored " + remaining.length() + " future reminder alarms");
        } catch (Exception e) {
            Log.e(TAG, "Failed to restore scheduled alarms", e);
        }
    }
}
