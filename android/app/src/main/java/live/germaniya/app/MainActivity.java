package live.germaniya.app;

import android.app.DownloadManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O'z plaginimiz — veb tomon "video ochildi/yopildi" deb xabar beradi.
        // Ro'yxatdan o'tkazish super.onCreate DAN OLDIN bo'lishi shart:
        // ko'prik (bridge) o'sha yerda quriladi va keyin qo'shilgan plagin
        // veb tomonga ko'rinmay qoladi.
        registerPlugin(ScreenGuardPlugin.class);
        super.onCreate(savedInstanceState);

        enableDownloads();
        tagUserAgent();
        installScreenGuard();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Ilova fondan qaytganda ham holat to'g'ri bo'lsin: foydalanuvchi
        // video sahifasida turib boshqa ilovaga o'tib, qaytishi mumkin.
        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            ScreenGuard.apply(this, ScreenGuard.isProtectedUrl(webView.getUrl()));
        }
    }

    /**
     * Ekran himoyasi — SAHIFA MANZILI bo'yicha, JS ga bog'liq bo'lmagan holda.
     *
     * Nega shunday: dastlab himoya faqat veb tomondan (ScreenGuardPlugin
     * orqali) yoqilardi. Telefonda sinovda u ishlamadi — ko'prikdagi
     * chaqiruv yetib bormasa yoki xatosi yutilsa, himoya jimgina yo'q bo'lib
     * qoladi va buni hech kim bilmaydi. Endi ilova qaysi sahifada turganini
     * O'ZI kuzatadi va video sahifalarida bayroqni o'zi qo'yadi.
     *
     * Uch hodisa kuzatiladi, chunki Next.js sahifalar orasida ko'pincha
     * to'liq yuklamasdan (history.pushState bilan) o'tadi — bunda
     * onPageStarted UMUMAN chaqirilmaydi, faqat doUpdateVisitedHistory:
     *   · onPageStarted        — to'liq yuklash boshlanganda
     *   · onPageFinished       — to'liq yuklash tugaganda
     *   · doUpdateVisitedHistory — pushState / replaceState / orqaga-oldinga
     *
     * Capacitor'ning o'z mijozi (BridgeWebViewClient) meros olinadi va har
     * usulda `super` chaqiriladi — so'rovlarni ushlash, xatolik sahifasi va
     * plagin ko'prigi o'z holicha ishlayveradi.
     */
    private void installScreenGuard() {
        final Bridge bridge = getBridge();
        if (bridge == null) return;

        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                guard(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                guard(url);
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                super.doUpdateVisitedHistory(view, url, isReload);
                guard(url);
            }
        });

        // Ilova ochilgan zahoti joriy sahifa uchun ham
        WebView webView = bridge.getWebView();
        if (webView != null) guard(webView.getUrl());
    }

    private void guard(String url) {
        ScreenGuard.apply(this, ScreenGuard.isProtectedUrl(url));
    }

    /**
     * User-Agent ga "GermaniyaLiveApp/<versiya>" qo'shadi.
     *
     * Versiya APK ning o'zidan (versionName) o'qiladi — har yig'ishda o'zi
     * yangilanadi. Ilgari bu capacitor.config.ts da "2.0" deb qotib qolgan
     * edi va server jurnalida hamma versiya bir xil ko'rinardi: qaysi
     * o'quvchi eski ilovada qolganini aniqlab bo'lmasdi.
     */
    private void tagUserAgent() {
        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return;

        String version = "?";
        try {
            version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception ignored) {
            // versiya o'qilmasa ham ilova ishlayveradi
        }

        WebSettings settings = webView.getSettings();
        settings.setUserAgentString(settings.getUserAgentString() + " GermaniyaLiveApp/" + version);
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
        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
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
