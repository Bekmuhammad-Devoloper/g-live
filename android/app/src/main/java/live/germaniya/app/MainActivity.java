package live.germaniya.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O'z plaginimiz — dars videosi ochilganda ekranni himoyalaydi.
        // Ro'yxatdan o'tkazish super.onCreate DAN OLDIN bo'lishi shart:
        // ko'prik (bridge) o'sha yerda quriladi va keyin qo'shilgan plagin
        // veb tomonga ko'rinmay qoladi.
        registerPlugin(ScreenGuardPlugin.class);
        super.onCreate(savedInstanceState);

        enableDownloads();
    }

    /**
     * Fayl yuklab olishni yoqadi.
     *
     * WebView o'zi fayl yuklab OLMAYDI: `Content-Disposition: attachment`
     * bo'lgan havola bosilsa, ishlovchi berilmagan bo'lsa u shunchaki jim
     * e'tiborsiz qoldiriladi. Foydalanuvchi uchun bu "tugma ishlamayapti"
     * bo'lib ko'rinadi — ilovaning o'z yangilanishini (germaniya.live/app
     * dagi APK) ilova ichidan yuklab bo'lmasdi.
     *
     * Endi yuklash Android'ning o'z yuklab olish menejeriga topshiriladi:
     * bildirishnomada jarayon ko'rinadi, fayl "Yuklamalar" papkasiga
     * tushadi va u yerdan ochiladi.
     */
    private void enableDownloads() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);

                // Seansga bog'liq fayllar (masalan shaxsiy hujjat) ham
                // yuklanishi uchun cookie'ni birga uzatamiz.
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) {
                    request.addRequestHeader("Cookie", cookie);
                }

                String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                request.setTitle(name);
                request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                );
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);

                DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (manager == null) return;
                manager.enqueue(request);

                Toast.makeText(this, "Yuklanmoqda: " + name, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Yuklab bo'lmadi", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
