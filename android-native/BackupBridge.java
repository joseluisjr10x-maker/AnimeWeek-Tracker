package com.animeweek.tracker;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.OutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class BackupBridge {
    private static final int REQUEST_CREATE_BACKUP = 7301;

    private final Activity activity;
    private String pendingJson;
    private String pendingFilename = "AnimeWeek_Backup.json";
    private String pendingCallbackId;
    private volatile boolean writeInProgress;

    public BackupBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public synchronized void saveJson(String filename, String json, String callbackId) {
        if (json == null || json.isEmpty()) {
            activity.runOnUiThread(() ->
                Toast.makeText(activity, "La copia está vacía.", Toast.LENGTH_LONG).show()
            );
            notifyResult(callbackId, false, "La copia está vacía.");
            return;
        }

        if (pendingJson != null || writeInProgress) {
            notifyResult(callbackId, false, "Ya hay otro guardado en curso. Espera a que termine.");
            return;
        }
        pendingJson = json;
        pendingCallbackId = safeCallbackId(callbackId);
        if (filename != null && !filename.trim().isEmpty()) {
            pendingFilename = filename.endsWith(".json") ? filename : filename + ".json";
        } else {
            pendingFilename = "AnimeWeek_Backup.json";
        }

        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, pendingFilename);
                activity.startActivityForResult(intent, REQUEST_CREATE_BACKUP);
            } catch (Exception e) {
                pendingJson = null;
                writeInProgress = false;
                String callback = pendingCallbackId;
                pendingCallbackId = null;
                notifyResult(callback, false, "No se pudo abrir el selector para guardar la copia.");
                Toast.makeText(activity,
                    "No se pudo abrir el selector para guardar la copia.",
                    Toast.LENGTH_LONG).show();
            }
        });
    }

    public synchronized boolean handleActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_CREATE_BACKUP) {
            return false;
        }

        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            pendingJson = null;
            writeInProgress = false;
            String callback = pendingCallbackId;
            pendingCallbackId = null;
            notifyResult(callback, false, "Guardado cancelado.");
            activity.runOnUiThread(() ->
                Toast.makeText(activity, "Guardado cancelado.", Toast.LENGTH_SHORT).show()
            );
            return true;
        }

        Uri uri = data.getData();
        String jsonToWrite = pendingJson;
        String callback = pendingCallbackId;
        pendingJson = null;
        pendingCallbackId = null;

        if (jsonToWrite == null) {
            notifyResult(callback, false, "No hay datos pendientes para guardar.");
            activity.runOnUiThread(() ->
                Toast.makeText(activity, "No hay datos pendientes para guardar.", Toast.LENGTH_LONG).show()
            );
            return true;
        }

        writeInProgress = true;
        new Thread(() -> {
            try {
                // La confirmación de éxito se envía únicamente después de cerrar el stream.
                // Así también se detectan errores que ocurran durante close().
                try (OutputStream output = activity.getContentResolver().openOutputStream(uri, "w")) {
                    if (output == null) {
                        throw new IOException("No se pudo abrir el archivo de destino.");
                    }
                    output.write(jsonToWrite.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                }
                writeInProgress = false;
                notifyResult(callback, true, "Copia de seguridad guardada correctamente.");
                activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Copia de seguridad guardada correctamente.",
                        Toast.LENGTH_LONG).show()
                );
            } catch (Exception e) {
                writeInProgress = false;
                String message = "Error al guardar la copia: " + (e.getMessage() == null ? "error de escritura" : e.getMessage());
                notifyResult(callback, false, message);
                activity.runOnUiThread(() ->
                    Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
                );
            }
        }).start();

        return true;
    }

    private String safeCallbackId(String callbackId) {
        if (callbackId == null || !callbackId.matches("[A-Za-z0-9_-]{1,100}")) return null;
        return callbackId;
    }

    private void notifyResult(String callbackId, boolean success, String message) {
        if (callbackId == null) return;
        String js = "(function(){var c=window.__animeWeekBackupCallbacks&&window.__animeWeekBackupCallbacks["
            + JSONObject.quote(callbackId) + "];if(c)c({success:" + success
            + ",message:" + JSONObject.quote(message == null ? "" : message) + "});})();";
        activity.runOnUiThread(() -> {
            try {
                android.webkit.WebView webView = null;
                if (activity instanceof com.getcapacitor.BridgeActivity) {
                    webView = ((com.getcapacitor.BridgeActivity) activity).getBridge().getWebView();
                }
                if (webView != null) webView.evaluateJavascript(js, null);
            } catch (Exception ignored) { }
        });
    }
}
