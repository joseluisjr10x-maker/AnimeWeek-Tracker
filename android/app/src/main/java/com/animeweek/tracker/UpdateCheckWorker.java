package com.animeweek.tracker;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequestBuilder;
import androidx.work.PeriodicWorkRequestBuilder;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/**
 * Checks the public GitHub release manifest while the app is not open.
 * Notifications are opt-in and deduplicated by the published Android versionCode.
 */
public final class UpdateCheckWorker extends Worker {
    public static final String UNIQUE_PERIODIC_NAME = "animeweek-update-check-periodic";
    public static final String UNIQUE_INITIAL_NAME = "animeweek-update-check-initial";
    public static final String PREFS_NAME = "animeweek_update_notifications";
    public static final String KEY_ENABLED = "enabled";
    private static final String KEY_LAST_NOTIFIED_CODE = "last_notified_version_code";
    private static final String CHANNEL_ID = "animeweek_updates";
    private static final int NOTIFICATION_ID = 953000;
    private static final String MANIFEST_URL =
            "https://raw.githubusercontent.com/joseluisjr10x-maker/AnimeWeek-Tracker/main/latest.json";

    public UpdateCheckWorker(Context context, WorkerParameters parameters) {
        super(context, parameters);
    }

    public static void schedule(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest periodic = new PeriodicWorkRequestBuilder<UpdateCheckWorker>(
                12, TimeUnit.HOURS
        ).setConstraints(constraints).build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodic
        );

        OneTimeWorkRequest initial = new OneTimeWorkRequestBuilder<UpdateCheckWorker>()
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_INITIAL_NAME,
                ExistingWorkPolicy.REPLACE,
                initial
        );
    }

    public static void cancel(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_PERIODIC_NAME);
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_INITIAL_NAME);
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ENABLED, false).apply();
    }

    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        if (!context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_ENABLED, false)) {
            return Result.success();
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return Result.success();
        }

        HttpURLConnection connection = null;
        try {
            URL url = new URL(MANIFEST_URL + "?check=" + System.currentTimeMillis());
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(12000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Accept", "application/json");

            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                throw new java.io.IOException("GitHub HTTP " + status);
            }

            StringBuilder body = new StringBuilder();
            try (InputStream input = connection.getInputStream();
                 BufferedReader reader = new BufferedReader(
                         new InputStreamReader(input, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }

            JSONObject root = new JSONObject(body.toString());
            if (!"com.animeweek.tracker".equals(root.optString("appId"))) {
                return Result.success();
            }

            JSONObject androidInfo = root.optJSONObject("android");
            if (androidInfo == null || !androidInfo.optBoolean("enabled", false)) {
                return Result.success();
            }

            long publishedCode = androidInfo.optLong("versionCode", root.optLong("versionCode", 0L));
            if (publishedCode <= 0L) return Result.success();

            PackageInfo installed = context.getPackageManager()
                    .getPackageInfo(context.getPackageName(), 0);
            long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? installed.getLongVersionCode() : installed.versionCode;

            if (publishedCode <= installedCode) return Result.success();

            android.app.NotificationManager notificationManager =
                    (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return Result.success();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Actualizaciones de AnimeWeek",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription("Avisos cuando haya una nueva versión de AnimeWeek Tracker.");
                notificationManager.createNotificationChannel(channel);
            }

            android.content.SharedPreferences preferences = context.getSharedPreferences(
                    PREFS_NAME, Context.MODE_PRIVATE);
            long lastNotifiedCode = preferences.getLong(KEY_LAST_NOTIFIED_CODE, 0L);
            if (publishedCode <= lastNotifiedCode) return Result.success();

            Intent launchIntent = context.getPackageManager()
                    .getLaunchIntentForPackage(context.getPackageName());
            if (launchIntent == null) return Result.success();
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    953000,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT |
                            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            String version = root.optString("version", "nueva");
            NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle("Nueva actualización disponible")
                    .setContentText("AnimeWeek Tracker v" + version)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(
                            "Ya puedes actualizar AnimeWeek Tracker a la versión " + version +
                                    ". Abre la app y entra al Centro de actualizaciones."
                    ))
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT);

            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification.build());
            preferences.edit().putLong(KEY_LAST_NOTIFIED_CODE, publishedCode).apply();
            return Result.success();
        } catch (SecurityException permissionError) {
            return Result.success();
        } catch (Exception error) {
            android.util.Log.w("AnimeWeekUpdates", "No se pudo comprobar el manifiesto de actualizaciones.", error);
            return Result.retry();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
