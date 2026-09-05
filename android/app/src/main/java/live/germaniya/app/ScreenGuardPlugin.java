package live.germaniya.app;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ekranni himoyalash — dars videolarini yozib olish va skrinshot qilishni
 * to'sadi.
 *
 * Android'da buni FLAG_SECURE bayrog'i qiladi. U yoqilganda:
 *   · skrinshot olinmaydi (tizim "ruxsat berilmagan" deb xabar beradi)
 *   · ekran yozuvida bu oyna qora bo'lib chiqadi
 *   · oxirgi ilovalar ro'yxatida ham mazmun ko'rinmaydi
 *   · tashqi ekranga (HDMI, translatsiya) uzatilmaydi
 *
 * Bayroq BUTUN oynaga tegishli, shu sabab uni faqat video ochilganda
 * yoqamiz va yopilganda darhol o'chiramiz — o'quvchi guvohnomasini yoki
 * natijasini skrinshot qilib ulasha olsin.
 *
 * Bayroqni asosiy (UI) oqimda o'zgartirish shart, aks holda Android
 * istisno ko'taradi — shuning uchun runOnUiThread.
 */
@CapacitorPlugin(name = "ScreenGuard")
public class ScreenGuardPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        final android.app.Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() ->
            activity.getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        );
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        final android.app.Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() ->
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        );
        call.resolve();
    }
}
