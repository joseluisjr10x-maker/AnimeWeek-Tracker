package com.animeweek.tracker;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.OutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class BackupBridge {
    private static final int REQUEST_CREATE_BACKUP = 7301;

    private final Activity activity;
    private String pendingJson;
    private String pendingFilename = "AnimeWeek_Backup.json";

    public BackupBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void saveJson(String filename, String json) {
        if (json == null || json.isEmpty()) {
            activity.runOnUiThread(() ->
                Toast.makeText(activity, "La copia está vacía.", Toast.LENGTH_LONG).show()
            );
            return;
        }

        pendingJson = json;
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
                Toast.makeText(activity,
                    "No se pudo abrir el selector para guardar la copia.",
                    Toast.LENGTH_LONG).show();
            }
        });
    }

    public boolean handleActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_CREATE_BACKUP) {
            return false;
        }

        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            pendingJson = null;
            activity.runOnUiThread(() ->
                Toast.makeText(activity, "Guardado cancelado.", Toast.LENGTH_SHORT).show()
            );
            return true;
        }

        Uri uri = data.getData();
        String jsonToWrite = pendingJson;
        pendingJson = null;

        if (jsonToWrite == null) {
            activity.runOnUiThread(() ->
                Toast.makeText(activity, "No hay datos pendientes para guardar.", Toast.LENGTH_LONG).show()
            );
            return true;
        }

        new Thread(() -> {
            try (OutputStream output = activity.getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) {
                    throw new IOException("No se pudo abrir el archivo de destino.");
                }
                output.write(jsonToWrite.getBytes(StandardCharsets.UTF_8));
                output.flush();

                activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Copia de seguridad guardada correctamente.",
                        Toast.LENGTH_LONG).show()
                );
            } catch (Exception e) {
                activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Error al guardar la copia: " + e.getMessage(),
                        Toast.LENGTH_LONG).show()
                );
            }
        }).start();

        return true;
    }
}
