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
            notifyResult(callbackId, false, "La copia está vacía.");
            showToast("La copia está vacía.");
            return;
        }

        if (pendingJson != null || writeInProgress) {
            notifyResult(callbackId, false, "Ya hay otro guardado en curso. Espera a que termine.");
            return;
        }

        pendingJson = json;
        pendingCallbackId = safeCallbackId(callbackId);
        pendingFilename = (filename != null && !filename.trim().isEmpty())
                ? (filename.toLowerCase(java.util.Locale.ROOT).endsWith(".json") ? filename : filename + ".json")
                : "AnimeWeek_Backup.json";

        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, pendingFilename);
                activity.startActivityForResult(intent, REQUEST_CREATE_BACKUP);
            } catch (Exception error) {
                String callback;
                synchronized (BackupBridge.this) {
                    pendingJson = null;
                    writeInProgress = false;
                    callback = pendingCallbackId;
                    pendingCallbackId = null;
                }
                notifyResult(callback, false, "No se pudo abrir el selector para guardar la copia.");
                showToast("No se pudo abrir el selector para guardar la copia.");
            }
        });
    }

    public synchronized boolean handleActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_CREATE_BACKUP) return false;

        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            pendingJson = null;
            writeInProgress = false;
            String callback = pendingCallbackId;
            pendingCallbackId = null;
            notifyResult(callback, false, "Guardado cancelado.");
            showToast("Guardado cancelado.");
            return true;
        }

        Uri uri = data.getData();
        String jsonToWrite = pendingJson;
        String callback = pendingCallbackId;
        pendingJson = null;
        pendingCallbackId = null;

        if (jsonToWrite == null) {
            notifyResult(callback, false, "No hay datos pendientes para guardar.");
            showToast("No hay datos pendientes para guardar.");
            return true;
        }

        writeInProgress = true;
        final String payload = jsonToWrite;
        new Thread(() -> {
            try {
                // Confirmar únicamente después de cerrar correctamente el stream.
                try (OutputStream output = activity.getContentResolver().openOutputStream(uri, "w")) {
                    if (output == null) throw new IOException("No se pudo abrir el archivo de destino.");
                    output.write(payload.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                }
                synchronized (BackupBridge.this) {
                    writeInProgress = false;
                }
                notifyResult(callback, true, "Copia de seguridad guardada correctamente.");
                showToast("Copia de seguridad guardada correctamente.");
            } catch (Exception error) {
                synchronized (BackupBridge.this) {
                    writeInProgress = false;
                }
                String message = "Error al guardar la copia: "
                        + (error.getMessage() == null ? "error de escritura" : error.getMessage());
                notifyResult(callback, false, message);
                showToast(message);
            }
        }, "AnimeWeekBackupWriter").start();

        return true;
    }

    private String safeCallbackId(String callbackId) {
        if (callbackId == null || !callbackId.matches("[A-Za-z0-9_-]{1,100}")) return null;
        return callbackId;
    }

    private void notifyResult(String callbackId, boolean success, String message) {
        if (callbackId == null) return;
        String js = "(function(){var callbacks=window.__animeWeekBackupCallbacks;"
                + "var callback=callbacks&&callbacks[" + JSONObject.quote(callbackId) + "];"
                + "if(callback){delete callbacks[" + JSONObject.quote(callbackId) + "];"
                + "callback({success:" + success + ",message:" + JSONObject.quote(message == null ? "" : message) + "});}"
                + "})();";

        activity.runOnUiThread(() -> {
            try {
                if (activity instanceof com.getcapacitor.BridgeActivity) {
                    com.getcapacitor.BridgeActivity bridgeActivity =
                            (com.getcapacitor.BridgeActivity) activity;
                    if (bridgeActivity.getBridge() != null && bridgeActivity.getBridge().getWebView() != null) {
                        bridgeActivity.getBridge().getWebView().evaluateJavascript(js, null);
                    }
                }
            } catch (Exception ignored) {
                // El selector nativo puede cerrarse cuando la actividad ya está terminando.
            }
        });
    }

    private void showToast(String message) {
        activity.runOnUiThread(() ->
                Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
        );
    }
}
