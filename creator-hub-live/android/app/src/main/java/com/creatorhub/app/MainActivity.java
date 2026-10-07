package com.creatorhub.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

/**
 * Hardened WebView host for Creator Hub Live.
 *
 * Design goals (match the web SPA resilience work):
 *  - Serve bundled assets over https://appassets.androidplatform.net/ via
 *    WebViewAssetLoader so the SPA runs in a secure https origin (localStorage,
 *    service worker, camera/mic for LiveKit all behave as on the real site).
 *  - NEVER leave the user on a blank/black screen: renderer crashes are
 *    recovered by rebuilding the WebView, and hard load errors paint a visible,
 *    recoverable in-app error page instead of a white void.
 *  - External links open in the system browser; internal navigation stays in-app.
 */
public class MainActivity extends AppCompatActivity {

    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String START_URL = APP_ORIGIN + "/assets/web/index.html";
    private static final int REQ_AV_PERMS = 1001;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private PermissionRequest pendingPermissionRequest;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        buildWebView();
        setContentView(webView);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    /** Create (or recreate) the WebView with all clients + settings applied. */
    @SuppressLint("SetJavaScriptEnabled")
    private void buildWebView() {
        webView = new WebView(this);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // Assets are served via the https asset-loader origin; raw file access off.
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }
        });
    }

    private final class AppWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return assetLoader.shouldInterceptRequest(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String host = url.getHost();
            // Keep in-app navigation inside the bundled origin; punt real external
            // links (http/https elsewhere, mailto, tel) to the system.
            if (host != null && host.equals("appassets.androidplatform.net")) {
                return false;
            }
            String scheme = url.getScheme();
            if (scheme == null) {
                return false;
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (Exception ignored) {
                // No handler for the scheme: stay in-app rather than crashing.
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            // Only paint the fallback for the top-level document, not subresources,
            // so a single failed asset never blanks the whole app.
            if (request.isForMainFrame()) {
                CharSequence desc = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && error != null)
                        ? error.getDescription() : "";
                showErrorPage(String.valueOf(desc));
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // The renderer died (OOM/crash). Destroy the dead view and rebuild a
            // fresh WebView so the user is never stranded on a black screen.
            try {
                if (webView != null) {
                    webView.destroy();
                }
            } catch (Exception ignored) {
            }
            buildWebView();
            setContentView(webView);
            webView.loadUrl(START_URL);
            return true; // handled; do not let the activity be killed
        }
    }

    /** Visible, recoverable in-app error page (no blank screen). */
    private void showErrorPage(String detail) {
        String safe = detail == null ? "" : detail
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        String html = "<!doctype html><html><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{margin:0;background:#0e0f13;color:#f3f4f6;"
                + "font-family:-apple-system,Roboto,Arial,sans-serif;"
                + "display:flex;min-height:100vh;align-items:center;justify-content:center}"
                + ".c{max-width:420px;padding:28px;text-align:center}"
                + "h1{font-size:19px;margin:0 0 10px}p{color:#9aa0ac;line-height:1.5;margin:0 0 20px}"
                + "button{background:#6d5efc;color:#fff;border:0;border-radius:10px;"
                + "padding:12px 22px;font-size:15px}</style></head><body><div class='c'>"
                + "<h1>Couldn\u2019t load Creator Hub Live</h1>"
                + "<p>Check your connection and try again." + (safe.isEmpty() ? "" : "<br><small>" + safe + "</small>") + "</p>"
                + "<button onclick=\"location.href='" + START_URL + "'\">Retry</button>"
                + "</div></body></html>";
        webView.loadDataWithBaseURL(APP_ORIGIN, html, "text/html", "utf-8", null);
    }

    // ---- camera/mic permissions for LiveKit ----

    private void handleWebPermission(PermissionRequest request) {
        boolean needsCam = false, needsMic = false;
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) needsCam = true;
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) needsMic = true;
        }
        boolean camOk = !needsCam || ContextCompat.checkSelfPermission(this,
                Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        boolean micOk = !needsMic || ContextCompat.checkSelfPermission(this,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        if (camOk && micOk) {
            request.grant(request.getResources());
        } else {
            pendingPermissionRequest = request;
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO},
                    REQ_AV_PERMS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_AV_PERMS && pendingPermissionRequest != null) {
            boolean anyGranted = false;
            for (int g : grantResults) {
                if (g == PackageManager.PERMISSION_GRANTED) anyGranted = true;
            }
            if (anyGranted) {
                pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
            } else {
                pendingPermissionRequest.deny();
            }
            pendingPermissionRequest = null;
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
