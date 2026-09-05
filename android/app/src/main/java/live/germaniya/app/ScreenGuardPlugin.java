package live.germaniya.app;

import android.app.Activity;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Veb tomon uchun ko'prik: "video ochildi" → himoya yoq, "yopildi" → o'chir.
 *
 * Asosiy himoya MainActivity da, sahifa manzili bo'yicha (ScreenGuard
 * sinfiga qarang) — u JS ga bog'liq emas. Bu plagin unga QO'SHIMCHA:
 * kelajakda boshqa sahifada ham vaqtincha himoya kerak bo'lsa, veb tomon
 * shu orqali so'raydi.
 *
 * `disable()` himoyalangan sahifada turib chaqirilsa E'TIBORSIZ qoladi:
 * o'quvchi videoni yopib, sahifada qolgan bo'lsa ham himoya turishi kerak
 * (qoida — butun sahifa, faqat ochiq video emas).
 */
@CapacitorPlugin(name = "ScreenGuard")
public class ScreenGuardPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        ScreenGuard.apply(getActivity(), true);
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        // WebView.getUrl() faqat UI oqimida chaqiriladi
        activity.runOnUiThread(() -> {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            String url = webView != null ? webView.getUrl() : null;
            if (!ScreenGuard.isProtectedUrl(url)) {
                ScreenGuard.apply(activity, false);
            }
        });
        call.resolve();
    }
}
