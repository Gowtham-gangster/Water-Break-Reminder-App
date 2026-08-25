package com.eyeflow.app;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EyeFlowNative")
public class EyeFlowNativePlugin extends Plugin {
    private static final String TAG = "EyeFlowNativePlugin";

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
