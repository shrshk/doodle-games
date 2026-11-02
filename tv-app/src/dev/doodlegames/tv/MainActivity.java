package dev.doodlegames.tv;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A full-screen WebView on the Doodle Games hub in TV mode (?tv=1): the page moves between its controls with the
 * remote's arrows (tvRemote.ts), so every game the hub lists can be picked and played without TV changes. BACK goes
 * to the previous page (a game back to the hub) and closes the app from the hub.
 *
 * Extra (am start -n dev.doodlegames.tv/.MainActivity --es games https://host): another games server, remembered.
 */
public class MainActivity extends Activity {
    private static final String PREFS = "games";
    private static final String KEY_URL = "url";

    private WebView web;
    private String games;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xFFFFF8E7);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);  // TV mode is kept in sessionStorage across the hub and the games
        s.setMediaPlaybackRequiresUserGesture(false);  // the games' sounds
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Only the games' own pages open here; nothing navigates away to the web.
                return !request.getUrl().toString().startsWith(games);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError(String.valueOf(error.getDescription()));
            }
        });
        setContentView(web);
        web.requestFocus();
        load(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        load(intent);
    }

    private void load(Intent intent) {
        String given = intent.getStringExtra("games");
        if (!TextUtils.isEmpty(given)) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_URL, given.replaceAll("/+$", "")).commit();
        }
        games = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_URL, getString(R.string.default_games));
        web.loadUrl(games + "/?tv=1");
    }

    private void showError(String why) {
        String html = "<body style='background:#fff8e7;color:#222;font-family:sans-serif;padding:8vw'>"
                + "<h2>Doodle Games is not answering</h2>"
                + "<p style='color:#666'>" + TextUtils.htmlEncode(games) + "<br>" + TextUtils.htmlEncode(why) + "</p>"
                + "<p style='color:#888'>Press BACK to close.</p></body>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else finish();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
