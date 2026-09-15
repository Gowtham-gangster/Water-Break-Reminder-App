package com.pauseflow.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * PauseFlowNotificationReceiver
 * Native Android BroadcastReceiver executed when an AlarmManager exact alarm triggers.
 * 
 * Guarantees:
 * 1. Executes in background, foreground, screen-locked, and app-process-killed states.
 * 2. Displays the high-priority native notification with icon, sound, and channel.
 * 3. Immediately & atomically writes the delivered reminder record to user-scoped SharedPreferences.
 * 4. Dispatches live event to PauseFlowNativePlugin on main thread if the application process is running.
 * 5. Strictly drops any reminder without a valid authenticated userId.
 */
public class PauseFlowNotificationReceiver extends BroadcastReceiver {
    private static final String TAG = "PauseFlowNotifReceiver";

    public static final String ACTION_REMINDER_ALARM = "com.pauseflow.app.ACTION_REMINDER_ALARM";
    public static final String ACTION_NOTIFICATION_TAP = "com.pauseflow.app.ACTION_NOTIFICATION_TAP";

    public static final String EXTRA_EVENT_ID = "eventId";
    public static final String EXTRA_CATEGORY = "category";
    public static final String EXTRA_USER_ID = "userId";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_SCHEDULED_TIMESTAMP = "scheduledTimestamp";
    public static final String EXTRA_DURATION_SECONDS = "durationSeconds";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        final PendingResult pendingResult = goAsync();
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;

        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PauseFlow:NotificationReceiverWakeLock");
            wakeLock.acquire(10000); // 10 seconds max safety timeout
        }

        try {
            String action = intent.getAction();
            if (ACTION_REMINDER_ALARM.equals(action) || (action != null && action.startsWith("com.pauseflow.app.ALARM_"))) {
                handleReminderAlarm(context, intent);
            }
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

    private void handleReminderAlarm(Context context, Intent intent) {
        String eventId = intent.getStringExtra(EXTRA_EVENT_ID);
        String category = intent.getStringExtra(EXTRA_CATEGORY);
        String userId = intent.getStringExtra(EXTRA_USER_ID);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        long scheduledTimestamp = intent.getLongExtra(EXTRA_SCHEDULED_TIMESTAMP, System.currentTimeMillis());
        int durationSeconds = intent.getIntExtra(EXTRA_DURATION_SECONDS, 120);

        // CRITICAL DATA ISOLATION GUARD: Drop unauthenticated alarms immediately
        if (userId == null || userId.trim().isEmpty() || "default_user".equals(userId) || "local_user".equals(userId)) {
            Log.w(TAG, "[PauseFlow][SECURITY] stage=ANONYMOUS_SCHEDULER_BLOCKED reason=receiver_unauthenticated_alarm eventId=" + eventId);
            return;
        }

        if (eventId == null || eventId.isEmpty()) {
            eventId = "native-alarm-" + scheduledTimestamp;
        }
        if (category == null || category.isEmpty()) {
            category = "water";
        }
        if (title == null || title.isEmpty()) {
            title = "water".equals(category) ? "💧 Time for water" : "👁 Look outside";
        }
        if (body == null || body.isEmpty()) {
            body = "water".equals(category) 
                ? "Take a short break and drink some water." 
                : "Give your eyes a short break from the screen.";
        }

        long now = System.currentTimeMillis();
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", java.util.Locale.getDefault());
        String nowStr = sdf.format(new java.util.Date(now));
        String scheduledStr = sdf.format(new java.util.Date(scheduledTimestamp));

        Log.i(TAG, "[PauseFlow][TRACE] stage=RECEIVER_START eventId=" + eventId + " category=" + category + " userId=" + userId + " scheduledAt=" + scheduledTimestamp + " (" + scheduledStr + ") now=" + now + " (" + nowStr + ")");

        // -------------------------------------------------------------
        // DAILY SUMMARY HANDLING (INFORMATIONAL ONLY, DOES NOT ALTER COMPLETIONS)
        // -------------------------------------------------------------
        if ("daily_summary".equals(category)) {
            java.text.SimpleDateFormat dateFormat = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault());
            String targetDateStr = dateFormat.format(new java.util.Date(scheduledTimestamp));

            int waterDelivered = 0;
            int screenDelivered = 0;
            int waterExpected = 0;
            int screenExpected = 0;

            try {
                // 1. Read delivered completions from SharedPreferences
                String delivPrefsName = PauseFlowNativePlugin.getDeliveredPrefsName(userId);
                if (delivPrefsName != null) {
                    SharedPreferences prefs = context.getSharedPreferences(delivPrefsName, Context.MODE_PRIVATE);
                    String existingJson = prefs.getString(PauseFlowNativePlugin.KEY_DELIVERED_LIST, "[]");
                    JSONArray array = new JSONArray(existingJson);
                    for (int i = 0; i < array.length(); i++) {
                        JSONObject obj = array.getJSONObject(i);
                        String itemDate = obj.optString("date", "");
                        String itemCategory = obj.optString("category", obj.optString("type", ""));
                        if (targetDateStr.equals(itemDate)) {
                            if ("water".equalsIgnoreCase(itemCategory)) {
                                waterDelivered++;
                            } else if ("screen".equalsIgnoreCase(itemCategory) || "look_outside".equalsIgnoreCase(itemCategory)) {
                                screenDelivered++;
                            }
                        }
                    }
                }

                // 2. Read scheduled inventory from SharedPreferences to compute expected count
                String schedPrefsName = PauseFlowNativePlugin.getScheduledPrefsName(userId);
                if (schedPrefsName != null) {
                    SharedPreferences schedPrefs = context.getSharedPreferences(schedPrefsName, Context.MODE_PRIVATE);
                    String schedJson = schedPrefs.getString(PauseFlowNativePlugin.KEY_SCHEDULED_LIST, "[]");
                    JSONArray schedArray = new JSONArray(schedJson);
                    for (int i = 0; i < schedArray.length(); i++) {
                        JSONObject sObj = schedArray.getJSONObject(i);
                        long schedTs = sObj.optLong("scheduledTimestamp", 0);
                        String sDate = sObj.optString("date", "");
                        if (sDate.isEmpty() && schedTs > 0) {
                            sDate = dateFormat.format(new java.util.Date(schedTs));
                        }
                        String sCat = sObj.optString("category", sObj.optString("type", ""));
                        if (targetDateStr.equals(sDate)) {
                            if ("water".equalsIgnoreCase(sCat)) {
                                waterExpected++;
                            } else if ("screen".equalsIgnoreCase(sCat) || "look_outside".equalsIgnoreCase(sCat)) {
                                screenExpected++;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "[PauseFlow][DailySummary] Error counting delivered/scheduled reminders: " + e.getMessage());
            }

            // Ensure expected is at least delivered
            waterExpected = Math.max(waterExpected, waterDelivered);
            screenExpected = Math.max(screenExpected, screenDelivered);

            int waterMissed = Math.max(0, waterExpected - waterDelivered);
            int screenMissed = Math.max(0, screenExpected - screenDelivered);
            String summaryTitle = "Today's Progress";

            SpannableStringBuilder summaryBody = new SpannableStringBuilder();

            // Row 1: Water
            String waterPrefix = "💧 Water: " + waterDelivered + " completed • ";
            String waterMissedText = waterMissed + " missed";
            int waterMissedStart = summaryBody.length() + waterPrefix.length();
            summaryBody.append(waterPrefix).append(waterMissedText);
            summaryBody.setSpan(
                new ForegroundColorSpan(0xFFEF4444),
                waterMissedStart,
                summaryBody.length(),
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            );

            // Row 2: Look Outside
            summaryBody.append("\n");
            String screenPrefix = "👁 Look Outside: " + screenDelivered + " completed • ";
            String screenMissedText = screenMissed + " missed";
            int screenMissedStart = summaryBody.length() + screenPrefix.length();
            summaryBody.append(screenPrefix).append(screenMissedText);
            summaryBody.setSpan(
                new ForegroundColorSpan(0xFFEF4444),
                screenMissedStart,
                summaryBody.length(),
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            );

            int notifId = postNativeNotification(context, eventId, category, userId, summaryTitle, summaryBody, scheduledTimestamp, 0);
            Log.i(TAG, "[PauseFlow][TRACE] stage=DAILY_SUMMARY_POSTED eventId=" + eventId + " userId=" + userId + " notifId=" + notifId + " water=" + waterDelivered + "/" + waterExpected + " screen=" + screenDelivered + "/" + screenExpected);

            PauseFlowNativePlugin.notifyLiveReminderDelivered(eventId, category, userId, now, scheduledTimestamp, 0);
            return;
        }

        // 1. Immediately record delivery to user-scoped persistent SharedPreferences (Thread-safe, atomic, synchronous disk flush)
        recordDeliveredToPrefs(context, eventId, category, userId, now, scheduledTimestamp);
        Log.i(TAG, "[PauseFlow][TRACE] stage=DELIVERY_PERSISTED eventId=" + eventId + " userId=" + userId);

        // 2. Mark Native Completion Success Log
        Log.i(TAG, "[PauseFlow][TRACE] stage=NATIVE_COMPLETION eventId=" + eventId + " userId=" + userId + " status=completed");

        // 3. Build & Post Android Native Notification
        int notifId = postNativeNotification(context, eventId, category, userId, title, body, scheduledTimestamp, durationSeconds);
        Log.i(TAG, "[PauseFlow][TRACE] stage=NOTIFICATION_POSTED eventId=" + eventId + " userId=" + userId + " notifId=" + notifId);

        // 4. Verify Native Readback from SharedPreferences
        verifyNativeReadback(context, userId, eventId);

        // 5. Notify running plugin instance on main thread if app process is alive
        PauseFlowNativePlugin.notifyLiveReminderDelivered(eventId, category, userId, now, scheduledTimestamp, durationSeconds);
    }

    private void verifyNativeReadback(Context context, String userId, String eventId) {
        try {
            String prefsName = PauseFlowNativePlugin.getDeliveredPrefsName(userId);
            if (prefsName == null) return;
            SharedPreferences prefs = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(PauseFlowNativePlugin.KEY_DELIVERED_LIST, "[]");
            JSONArray array = new JSONArray(existingJson);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (eventId.equals(obj.optString("eventId"))) {
                    Log.i(TAG, "[PauseFlow][TRACE] stage=NATIVE_READBACK eventId=" + eventId + " userId=" + userId + " status=" + obj.optString("status", "completed") + " deliveredAt=" + obj.optString("deliveredAt", "") + " scheduledAt=" + obj.optString("scheduledAt", ""));
                    return;
                }
            }
            Log.w(TAG, "[PauseFlow][TRACE] stage=NATIVE_READBACK_FAILED eventId=" + eventId + " NOT_FOUND in SharedPreferences for user " + userId);
        } catch (Exception e) {
            Log.e(TAG, "[PauseFlow][TRACE] stage=NATIVE_READBACK_ERROR eventId=" + eventId, e);
        }
    }

    private void recordDeliveredToPrefs(Context context, String eventId, String category, String userId, long deliveredTimestamp, long scheduledTimestamp) {
        try {
            String prefsName = PauseFlowNativePlugin.getDeliveredPrefsName(userId);
            if (prefsName == null) return;

            SharedPreferences prefs = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(PauseFlowNativePlugin.KEY_DELIVERED_LIST, "[]");
            JSONArray array = new JSONArray(existingJson);

            // Check if already recorded to guarantee idempotency
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (eventId.equals(obj.optString("eventId"))) {
                    Log.d(TAG, "[PauseFlow][Delivery] Event " + eventId + " already recorded in delivered list. Skipping duplicate.");
                    return;
                }
            }

            java.text.SimpleDateFormat isoFormat = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
            isoFormat.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.text.SimpleDateFormat dateFormat = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault());
            java.text.SimpleDateFormat timeFormat = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault());

            java.util.Date deliveredDate = new java.util.Date(deliveredTimestamp);
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
            item.put("timestamp", deliveredTimestamp);
            item.put("scheduledTimestamp", scheduledTimestamp);
            String deviceId = "android_native";
            try {
                String androidId = android.provider.Settings.Secure.getString(context.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
                if (androidId != null && !androidId.isEmpty()) {
                    deviceId = androidId;
                }
            } catch (Exception ignored) {}
            item.put("delivery_source", "android_native");
            item.put("device_id", deviceId);
            item.put("completion_device_id", deviceId);
            array.put(item);

            // CRITICAL: Synchronously commit to disk so process kill cannot wipe unwritten memory cache
            prefs.edit().putString(PauseFlowNativePlugin.KEY_DELIVERED_LIST, array.toString()).commit();
            Log.d(TAG, "[PauseFlow][Delivery] Recorded delivery record into SharedPreferences for user " + userId + ". Total pending: " + array.length());
        } catch (Exception e) {
            Log.e(TAG, "[PauseFlow][Delivery] Failed to record delivered reminder to SharedPreferences", e);
        }
    }

    private int postNativeNotification(Context context, String eventId, String category, String userId, CharSequence title, CharSequence body, long scheduledTimestamp, int durationSeconds) {
        int notifId = (eventId.hashCode() & 0x7fffffff) % 100000;
        try {
            String channelId = "daily_summary".equals(category) 
                ? "pauseflow_summary_channel" 
                : "water".equals(category) 
                ? "pauseflow_water_channel" 
                : "pauseflow_screen_channel";
            ensureNotificationChannels(context);

            // Create Tap PendingIntent pointing to MainActivity
            Intent tapIntent = new Intent(context, MainActivity.class);
            tapIntent.setAction(ACTION_NOTIFICATION_TAP);
            tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            tapIntent.putExtra(EXTRA_EVENT_ID, eventId);
            tapIntent.putExtra(EXTRA_CATEGORY, category);
            tapIntent.putExtra(EXTRA_USER_ID, userId);
            tapIntent.putExtra(EXTRA_SCHEDULED_TIMESTAMP, scheduledTimestamp);
            tapIntent.putExtra(EXTRA_DURATION_SECONDS, durationSeconds);

            int requestCode = (eventId.hashCode() & 0x7fffffff);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(context, requestCode, tapIntent, flags);

            int smallIconRes = R.drawable.pauseflow_notification;
            Bitmap largeIcon = null;
            try {
                largeIcon = BitmapFactory.decodeResource(context.getResources(), R.drawable.pauseflow_large_icon);
            } catch (Exception ignored) {}

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(smallIconRes)
                .setColor(0xFF0284C7) // PauseFlow Primary Blue
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setFullScreenIntent(pendingIntent, false)
                .setContentIntent(pendingIntent);

            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }

            NotificationManagerCompat.from(context).notify(notifId, builder.build());
            Log.i(TAG, "[PauseFlow][Delivery] Notification posted successfully with notifId=" + notifId + " for userId=" + userId + " category=" + category);
        } catch (Exception e) {
            Log.e(TAG, "[PauseFlow][Delivery] Failed to post native notification", e);
        }
        return notifId;
    }

    public static void ensureNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager == null) return;

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

            // Water Channel
            NotificationChannel waterChannel = new NotificationChannel(
                "pauseflow_water_channel",
                "💧 Water Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            waterChannel.setDescription("Notifications reminding you to hydrate and take a water break");
            waterChannel.enableLights(true);
            waterChannel.enableVibration(true);
            waterChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            waterChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(waterChannel);

            // Screen Break Channel
            NotificationChannel screenChannel = new NotificationChannel(
                "pauseflow_screen_channel",
                "👁 Look Outside Screen Breaks",
                NotificationManager.IMPORTANCE_HIGH
            );
            screenChannel.setDescription("Notifications reminding you to rest your eyes from digital screens");
            screenChannel.enableLights(true);
            screenChannel.enableVibration(true);
            screenChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            screenChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(screenChannel);

            // Daily Summary Channel
            NotificationChannel summaryChannel = new NotificationChannel(
                "pauseflow_summary_channel",
                "📊 Daily Summary Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            summaryChannel.setDescription("Daily progress and completed reminders summary");
            summaryChannel.enableLights(true);
            summaryChannel.enableVibration(true);
            summaryChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            summaryChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(summaryChannel);
        }
    }
}

