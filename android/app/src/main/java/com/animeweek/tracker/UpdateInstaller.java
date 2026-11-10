package com.animeweek.tracker;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Secure APK updater bridge for AnimeWeek Tracker.
 * Downloads only GitHub Release APK assets, validates SHA-256, package ID,
 * increasing versionCode and signing certificate before opening Android's installer.
 */
public final class UpdateInstaller {
    private static final String PREFS = "animeweek_update_installer";
    private static final String KEY_DOWNLOAD_ID = "download_id";
    private static final String KEY_FILE_NAME = "file_name";
    private static final String KEY_SHA256 = "expected_sha256";
    private static final String KEY_VERSION = "target_version";
    private static final String KEY_PENDING_INSTALL = "pending_install_path";
    private static final Pattern SHA256_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");

    private final MainActivity activity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final SharedPreferences prefs;
    private final DownloadManager downloadManager;
    private BroadcastReceiver downloadReceiver;
    private boolean receiverRegistered = false;

    public UpdateInstaller(MainActivity activity) {
        this.activity = activity;
        this.prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        this.downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
    }

    public void register() {
        if (receiverRegistered || downloadReceiver != null) return;
        downloadReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
                long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                long expectedId = prefs.getLong(KEY_DOWNLOAD_ID, -2L);
                if (completedId != expectedId || expectedId < 0) return;
                handleDownloadComplete(completedId);
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(downloadReceiver, filter);
        }
        receiverRegistered = true;
    }

    @JavascriptInterface
    public String getInstalledVersion() {
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return info.versionName == null ? "95.30.1" : info.versionName;
        } catch (Exception ignored) {
            return "95.30.1";
        }
    }

    @JavascriptInterface
    public void setLauncherTheme(String theme) {
        final String normalized = normalizeLauncherTheme(theme);
        mainHandler.post(() -> applyLauncherTheme(normalized));
    }

    private String normalizeLauncherTheme(String theme) {
        String value = theme == null ? "" : theme.trim().toLowerCase(Locale.ROOT);
        switch (value) {
            case "aurora": case "violet": case "ocean": case "sunset":
            case "gold": case "mono": case "halloween": case "christmas":
            case "newyear": case "valentines": case "spring": case "dayofdead":
                return value;
            default:
                return "aurora";
        }
    }

    private void applyLauncherTheme(String theme) {
        String[] themes = {"aurora","violet","ocean","sunset","gold","mono",
                "halloween","christmas","newyear","valentines","spring","dayofdead"};
        PackageManager manager = activity.getPackageManager();
        String targetSuffix = Character.toUpperCase(theme.charAt(0)) + theme.substring(1);
        try {
            // Habilitar primero el destino evita que el dispositivo se quede sin icono lanzador.
            ComponentName target = new ComponentName(activity.getPackageName(),
                    activity.getPackageName() + ".Launcher" + targetSuffix);
            manager.setComponentEnabledSetting(target,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP);

            for (String item : themes) {
                if (item.equals(theme)) continue;
                String suffix = Character.toUpperCase(item.charAt(0)) + item.substring(1);
                ComponentName component = new ComponentName(activity.getPackageName(),
                        activity.getPackageName() + ".Launcher" + suffix);
                manager.setComponentEnabledSetting(component,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP);
            }
        } catch (Exception error) {
            android.util.Log.w("AnimeWeekUpdate", "No se pudo cambiar el icono de lanzamiento para el tema " + theme, error);
        }
    }

    public static final int REQUEST_POST_NOTIFICATIONS = 9531;

    @JavascriptInterface
    public boolean areUpdateNotificationsEnabled() {
        boolean enabled = activity.getSharedPreferences(
                UpdateCheckWorker.PREFS_NAME, Context.MODE_PRIVATE
        ).getBoolean(UpdateCheckWorker.KEY_ENABLED, false);
        if (!enabled) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @JavascriptInterface
    public void enableUpdateNotifications() {
        mainHandler.post(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED) {
                activity.requestPermissions(
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        REQUEST_POST_NOTIFICATIONS
                );
                return;
            }
            scheduleUpdateNotifications();
        });
    }

    @JavascriptInterface
    public void disableUpdateNotifications() {
        mainHandler.post(() -> {
            UpdateCheckWorker.cancel(activity);
            notifyWeb("notifications-disabled", "Los avisos automáticos de actualizaciones están desactivados.");
        });
    }

    public void onNotificationPermissionResult(boolean granted) {
        if (granted) {
            scheduleUpdateNotifications();
        } else {
            notifyWeb("notifications-denied",
                    "No se concedió el permiso. Puedes activarlo después desde los ajustes de Android.");
        }
    }

    private void scheduleUpdateNotifications() {
        activity.getSharedPreferences(UpdateCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putBoolean(UpdateCheckWorker.KEY_ENABLED, true).apply();
        UpdateCheckWorker.schedule(activity);
        notifyWeb("notifications-enabled",
                "Avisos activados. Revisaremos GitHub ahora y después aproximadamente cada 12 horas.");
    }

    @JavascriptInterface
    public void downloadAndInstall(String apkUrl, String expectedSha256, String version) {
        mainHandler.post(() -> beginDownload(apkUrl, expectedSha256, version));
    }

    private void beginDownload(String apkUrl, String expectedSha256, String version) {
        try {
            if (downloadManager == null) throw new IllegalStateException("El administrador de descargas de Android no está disponible.");
            URI uri = URI.create(apkUrl == null ? "" : apkUrl);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"github.com".equals(host)
                    || !path.contains("/releases/download/") || !path.toLowerCase(Locale.ROOT).endsWith(".apk")) {
                throw new SecurityException("La descarga no es un APK de un GitHub Release autorizado.");
            }
            if (!SHA256_PATTERN.matcher(expectedSha256 == null ? "" : expectedSha256).matches()) {
                throw new SecurityException("GitHub no proporcionó un hash SHA-256 válido. Se canceló la descarga.");
            }

            String safeVersion = (version == null ? "update" : version).replaceAll("[^0-9A-Za-z._-]", "_");
            String fileName = "AnimeWeek-Tracker-" + safeVersion + ".apk";
            File downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadDir == null) throw new IllegalStateException("Android no proporcionó una carpeta de descargas privada.");
            File destination = new File(downloadDir, fileName);
            if (destination.exists() && !destination.delete()) throw new IllegalStateException("No se pudo reemplazar una descarga anterior.");

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl));
            request.setTitle("Actualización de AnimeWeek Tracker");
            request.setDescription("Descargando versión " + safeVersion);
            request.setMimeType("application/vnd.android.package-archive");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                request.setAllowedOverMetered(true);
            }
            request.setAllowedOverRoaming(false);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, fileName);

            long id = downloadManager.enqueue(request);
            prefs.edit()
                    .putLong(KEY_DOWNLOAD_ID, id)
                    .putString(KEY_FILE_NAME, fileName)
                    .putString(KEY_SHA256, expectedSha256.toLowerCase(Locale.ROOT))
                    .putString(KEY_VERSION, safeVersion)
                    .remove(KEY_PENDING_INSTALL)
                    .apply();
            notifyWeb("downloading", "Descarga iniciada. Android mostrará el progreso en sus notificaciones.");
        } catch (Exception error) {
            notifyWeb("error", safeMessage(error));
        }
    }

    private void handleDownloadComplete(long downloadId) {
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        try (android.database.Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) throw new IllegalStateException("No se encontró el resultado de la descarga.");
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                throw new IllegalStateException("Android no pudo completar la descarga (código " + reason + ").");
            }
        } catch (Exception error) {
            clearDownloadState();
            notifyWeb("error", safeMessage(error));
            return;
        }

        String fileName = prefs.getString(KEY_FILE_NAME, "");
        File directory = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File apk = directory == null ? null : new File(directory, fileName);
        try {
            if (apk == null || !apk.isFile() || apk.length() <= 0) throw new IllegalStateException("El APK descargado no existe o está vacío.");
            String expectedHash = prefs.getString(KEY_SHA256, "");
            String actualHash = sha256(apk);
            if (!actualHash.equalsIgnoreCase(expectedHash)) throw new SecurityException("La verificación SHA-256 falló. El APK se eliminó por seguridad.");
            verifyPackageAndSignature(apk);
            notifyWeb("verified", "Descarga verificada. Preparando el instalador de Android…");
            tryInstall(apk);
        } catch (Exception error) {
            if (apk != null && error instanceof SecurityException) apk.delete();
            clearDownloadState();
            notifyWeb("error", safeMessage(error));
        }
    }

    private void verifyPackageAndSignature(File apk) throws Exception {
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo installed = pm.getPackageInfo(activity.getPackageName(), flags);
        if (candidate == null || !activity.getPackageName().equals(candidate.packageName)) {
            throw new SecurityException("El APK no pertenece a AnimeWeek Tracker.");
        }
        long candidateCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? candidate.getLongVersionCode() : candidate.versionCode;
        long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
        if (candidateCode <= installedCode) throw new SecurityException("La versión descargada no es más nueva que la instalada.");

        android.content.pm.Signature[] candidateSignatures;
        android.content.pm.Signature[] installedSignatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            candidateSignatures = candidate.signingInfo == null ? null : candidate.signingInfo.getApkContentsSigners();
            installedSignatures = installed.signingInfo == null ? null : installed.signingInfo.getApkContentsSigners();
        } else {
            candidateSignatures = candidate.signatures;
            installedSignatures = installed.signatures;
        }
        if (candidateSignatures == null || installedSignatures == null || candidateSignatures.length == 0 || installedSignatures.length == 0) {
            throw new SecurityException("No fue posible verificar el certificado de firma.");
        }
        boolean matchingSigner = false;
        for (android.content.pm.Signature target : candidateSignatures) {
            String targetDigest = sha256(target.toByteArray());
            for (android.content.pm.Signature current : installedSignatures) {
                if (targetDigest.equals(sha256(current.toByteArray()))) matchingSigner = true;
            }
        }
        if (!matchingSigner) throw new SecurityException("La firma digital del APK no coincide con la aplicación instalada. No se instalará para proteger tus datos.");
    }

    private void tryInstall(File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            prefs.edit().putString(KEY_PENDING_INSTALL, apk.getAbsolutePath()).apply();
            notifyWeb("permission", "Permite a AnimeWeek Tracker instalar actualizaciones desde esta fuente y regresa a la app.");
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(settings);
            return;
        }
        launchInstaller(apk);
    }

    public void onHostResume() {
        String pending = prefs.getString(KEY_PENDING_INSTALL, null);
        if (pending == null || pending.isEmpty()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) return;
        prefs.edit().remove(KEY_PENDING_INSTALL).apply();
        File apk = new File(pending);
        if (apk.isFile()) launchInstaller(apk);
        else notifyWeb("error", "No se encontró el APK pendiente de instalación. Vuelve a descargarlo.");
    }

    private void launchInstaller(File apk) {
        try {
            Uri contentUri = FileProvider.getUriForFile(activity,
                    activity.getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(contentUri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(install);
            notifyWeb("installing", "Android abrió el instalador. Confirma la actualización para continuar.");
        } catch (Exception error) {
            notifyWeb("error", "No se pudo abrir el instalador: " + safeMessage(error));
        }
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        return toHex(digest.digest());
    }

    private String sha256(byte[] bytes) throws Exception {
        return toHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private String toHex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format(Locale.ROOT, "%02x", value));
        return result.toString();
    }

    private void notifyWeb(String status, String message) {
        WebView webView = activity.getBridge() == null ? null : activity.getBridge().getWebView();
        if (webView == null) return;
        String js = "window.__awUpdateNativeStatus&&window.__awUpdateNativeStatus(" +
                JSONObject.quote(status) + "," + JSONObject.quote(message) + ");";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void clearDownloadState() {
        prefs.edit().remove(KEY_DOWNLOAD_ID).remove(KEY_FILE_NAME).remove(KEY_SHA256).remove(KEY_VERSION).apply();
    }

    private String safeMessage(Exception error) {
        String message = error == null ? null : error.getMessage();
        return message == null || message.trim().isEmpty() ? "Ocurrió un error durante la actualización." : message;
    }

    public void release() {
        if (receiverRegistered && downloadReceiver != null) {
            try { activity.unregisterReceiver(downloadReceiver); } catch (IllegalArgumentException ignored) { }
        }
        receiverRegistered = false;
        downloadReceiver = null;
    }
}
