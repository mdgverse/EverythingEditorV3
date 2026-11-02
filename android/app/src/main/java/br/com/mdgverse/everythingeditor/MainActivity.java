package br.com.mdgverse.everythingeditor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Casca Android do Everything Editor.
 *
 * O editor é um arquivo HTML único e offline. Ele é servido pelo WebView a partir
 * de assets/ usando uma origem https sintética (appassets.androidplatform.net), o que
 * garante contexto seguro: localStorage, IndexedDB e canvas funcionam normalmente e
 * os dados do usuário ficam no próprio aparelho.
 */
public class MainActivity extends Activity {

    private static final String TAG = "EverythingEditor";
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + APP_HOST + "/index.html";
    private static final int REQ_FILE = 4001;
    private static final int BG = Color.parseColor("#1b1b1b");

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // Desenha de ponta a ponta e trata as barras do sistema por insets (Android 15 exige).
        Window win = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            win.setDecorFitsSystemWindows(false);
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);

        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);      // necessário para abrir arquivos escolhidos pelo usuário
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        try {
            s.setSafeBrowsingEnabled(false);
        } catch (Throwable ignored) {
            // API antiga
        }

        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable);

        // Ponte usada pelo editor para gravar arquivos (Exportar PNG, salvar grafo…).
        web.addJavascriptInterface(new SaveBridge(this), "AndroidSave");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u == null || APP_HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    Log.w(TAG, "Cannot open external link: " + u, e);
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("document.documentElement.classList.add('ee-app');", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                }
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, REQ_FILE);
                    return true;
                } catch (Exception e) {
                    Log.w(TAG, "File chooser failed", e);
                    fileCallback = null;
                    return false;
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage msg) {
                Log.d(TAG, "console: " + msg.message() + " (" + msg.lineNumber() + ")");
                return true;
            }
        });

        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = Math.max(bars.bottom, ime.bottom);
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            web.setPadding(left, top, right, bottom);
            return insets;
        });

        web.loadUrl(START_URL);
    }

    // ------------------------------------------------------------------ assets

    private WebResourceResponse serveAsset(Uri url) {
        if (url == null) return null;
        String host = url.getHost();
        if (host == null || !host.equals(APP_HOST)) return null;

        String path = url.getPath();
        if (path == null || path.length() <= 1) path = "/index.html";
        String assetPath = path.substring(1);

        try {
            InputStream in = getAssets().open(assetPath);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            WebResourceResponse res;
            if ("html".equals(ext(assetPath))) {
                res = new WebResourceResponse("text/html", "UTF-8", in);
            } else {
                res = new WebResourceResponse(mimeOf(assetPath), null, in);
            }
            res.setResponseHeaders(headers);
            return res;
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                    new HashMap<String, String>(), null);
        }
    }

    private static String ext(String path) {
        int dot = path.lastIndexOf('.');
        return dot < 0 ? "" : path.substring(dot + 1).toLowerCase();
    }

    private static String mimeOf(String path) {
        switch (ext(path)) {
            case "html": return "text/html";
            case "js":   return "application/javascript";
            case "css":  return "text/css";
            case "json": return "application/json";
            case "svg":  return "image/svg+xml";
            case "png":  return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "gif":  return "image/gif";
            case "woff": return "font/woff";
            case "woff2":return "font/woff2";
            case "ttf":  return "font/ttf";
            case "mp4":  return "video/mp4";
            case "webm": return "video/webm";
            case "wasm": return "application/wasm";
            default:     return "application/octet-stream";
        }
    }

    // ------------------------------------------------------------------ picking

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            if (fileCallback != null) {
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ------------------------------------------------------------------ back

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // O editor decide: fecha o painel/menu aberto ou devolve false para sair.
        web.evaluateJavascript(
                "(function(){try{return !!(window.__eeAndroidBack && window.__eeAndroidBack());}catch(e){return false;}})()",
                value -> {
                    boolean handled = value != null && value.contains("true");
                    if (!handled) moveTaskToBack(true);
                });
    }

    // ------------------------------------------------------------------ lifecycle

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidSave");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
