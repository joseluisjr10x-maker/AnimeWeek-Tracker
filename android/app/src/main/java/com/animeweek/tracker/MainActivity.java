
package com.animeweek.tracker;

import android.os.Bundle;
import android.content.Intent;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private BackupBridge animeWeekBackupBridge;
    private UpdateInstaller animeWeekUpdateInstaller;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        animeWeekBackupBridge = new BackupBridge(this);
        animeWeekUpdateInstaller = new UpdateInstaller(this);
        animeWeekUpdateInstaller.register();

        getBridge()
                .getWebView()
                .addJavascriptInterface(
                        animeWeekBackupBridge,
                        "AnimeWeekBackup"
                );

        getBridge()
                .getWebView()
                .addJavascriptInterface(
                        animeWeekUpdateInstaller,
                        "AndroidUpdateInstaller"
                );
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (animeWeekUpdateInstaller != null) {
            animeWeekUpdateInstaller.onHostResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (animeWeekUpdateInstaller != null) {
            animeWeekUpdateInstaller.release();
        }
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (animeWeekBackupBridge != null) {
            animeWeekBackupBridge.handleActivityResult(
                    requestCode,
                    resultCode,
                    data
            );
        }
    }
}

