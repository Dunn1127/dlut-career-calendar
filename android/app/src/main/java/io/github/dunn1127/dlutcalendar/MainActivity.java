package io.github.dunn1127.dlutcalendar;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.JSONObject;

public class MainActivity extends Activity {
    static final String HOME = "https://dunn1127.github.io/dlut-career-calendar/";
    private static final int SAVE_CALENDAR = 10;
    WebView web;
    String pendingCalendar;
    private LinearLayout error;
    private ProgressBar progress;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(246,245,244));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 6));
        error = new LinearLayout(this);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setPadding(32, 48, 32, 32);
        TextView message = new TextView(this);
        message.setText("暂时无法打开日历，请检查网络后重试。");
        message.setTextSize(18);
        error.addView(message);
        Button retry = new Button(this);
        retry.setText("重新加载");
        retry.setOnClickListener(v -> loadHome());
        error.addView(retry);
        error.setVisibility(View.GONE);
        root.addView(error);
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "AndroidCalendar",
                Collections.singleton("https://dunn1127.github.io"), (view, messageData, origin, mainFrame, reply) -> {
                    if (!mainFrame || !isCalendarUrl(Uri.parse(view.getUrl() == null ? "" : view.getUrl()))) return;
                    try {
                        String data = messageData.getData();
                        if (data == null || data.length() > 8_000_000) throw new IllegalArgumentException();
                        JSONObject json = new JSONObject(data);
                        saveCalendar(json.getString("contents"), json.getString("filename"));
                    } catch (Exception invalid) { toast("无法导出日历，请重试"); }
                });
        } else {
            toast("请更新 Android System WebView，以支持日历导出");
        }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isCalendarUrl(request.getUrl())) return false;
                if (request.isForMainFrame()) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) { progress.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError issue) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showError();
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, size) -> {
            toast("请更新 Android System WebView，或在浏览器中导出日历");
            openExternal(Uri.parse(HOME));
        });
        if (saved != null && saved.getBoolean("savingCalendar")) {
            try { pendingCalendar = new String(java.nio.file.Files.readAllBytes(new java.io.File(getCacheDir(), "pending.ics").toPath()), StandardCharsets.UTF_8); }
            catch (Exception missing) { pendingCalendar = null; }
        }
        loadHome();
    }

    static boolean isCalendarUrl(Uri uri) {
        return "https".equals(uri.getScheme()) && "dunn1127.github.io".equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443)
            && uri.getPath() != null && uri.getPath().startsWith("/dlut-career-calendar/");
    }
    private void openExternal(Uri uri) {
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException missing) { toast("没有可用的浏览器"); }
    }
    private void loadHome() { error.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); progress.setVisibility(View.VISIBLE); web.loadUrl(HOME); }
    private void showError() { progress.setVisibility(View.GONE); web.setVisibility(View.GONE); error.setVisibility(View.VISIBLE); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
    private void saveCalendar(String contents, String filename) {
        if (pendingCalendar != null) { toast("请先完成当前文件保存"); return; }
        if (!contents.startsWith("BEGIN:VCALENDAR\r\n") || !contents.endsWith("END:VCALENDAR\r\n")) {
            toast("日历内容无效"); return;
        }
        pendingCalendar = contents;
        try { java.nio.file.Files.write(new java.io.File(getCacheDir(), "pending.ics").toPath(), contents.getBytes(StandardCharsets.UTF_8)); }
        catch (Exception failure) { pendingCalendar = null; toast("暂时无法保存，请重试"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType("text/calendar").putExtra(Intent.EXTRA_TITLE, filename.replaceAll("[^a-zA-Z0-9._-]", "_") + (filename.endsWith(".ics") ? "" : ".ics"));
        try { startActivityForResult(intent, SAVE_CALENDAR); }
        catch (ActivityNotFoundException missing) { pendingCalendar = null; toast("未找到文件保存工具"); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != SAVE_CALENDAR) return;
        String contents = pendingCalendar;
        pendingCalendar = null;
        new java.io.File(getCacheDir(), "pending.ics").delete();
        if (result != RESULT_OK || data == null || data.getData() == null || contents == null) return;
        Uri target = data.getData();
        new Thread(() -> {
            try (OutputStream output = getContentResolver().openOutputStream(target, "wt")) {
                if (output == null) throw new java.io.IOException();
                output.write(contents.getBytes(StandardCharsets.UTF_8));
                runOnUiThread(() -> toast("日历已保存，可用日历应用打开导入"));
            } catch (Exception failure) { runOnUiThread(() -> toast("保存失败，请重新导出")); }
        }).start();
    }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); state.putBoolean("savingCalendar", pendingCalendar != null); }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(()=>{const d=document.querySelector('.detail-panel');const f=document.querySelector('#filter-dialog[open]');if(d||f){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(f)f.close();return true;}return false;})()", handled -> {
            if (!"true".equals(handled)) { if (web.canGoBack()) web.goBack(); else finish(); }
        });
    }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
