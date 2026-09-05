package live.germaniya.app;

import android.app.Activity;
import android.net.Uri;
import android.view.WindowManager;

/**
 * Ekran himoyasi — dars videolarini yozib olish va skrinshot qilishni
 * to'sish uchun umumiy qoida va uni qo'llash.
 *
 * Android'da buni FLAG_SECURE bayrog'i qiladi. U yoqilganda:
 *   · skrinshot olinmaydi (tizim "ruxsat berilmagan" deb xabar beradi)
 *   · ekran yozuvida bu oyna qora bo'lib chiqadi
 *   · oxirgi ilovalar ro'yxatida ham mazmun ko'rinmaydi
 *   · tashqi ekranga (HDMI, translatsiya) uzatilmaydi
 *
 * Bu sinf IKKI joydan ishlatiladi:
 *   1. MainActivity — sahifa manzili (URL) bo'yicha, JS ga BOG'LIQ BO'LMAGAN
 *      holda. Ilova qaysi sahifada turganini o'zi biladi; veb tomon
 *      ishlamasa ham himoya qoladi.
 *   2. ScreenGuardPlugin — veb tomondan "video ochildi/yopildi" chaqiruvi.
 *
 * Qoidaning bitta manbasi bo'lishi uchun (ikkalasi bir xil sahifani
 * himoyalasin) yo'llar shu yerda, bir joyda.
 */
final class ScreenGuard {

    private ScreenGuard() {}

    /**
     * Shu sahifalarda skrinshot va ekran yozuvi to'siladi:
     *   /student/kurse/{daraja}/{bo'lim}/dars/video — dars videosi
     *   /student/videos                             — video va podkastlar
     *
     * Sahifaning o'zi butunlay himoyalanadi (faqat video ochiq paytda emas):
     * o'quvchi video ustidagi tugmani bosgunga qadar ham yozib olishni
     * boshlab qo'yishi mumkin, keyin esa bayroq kech qo'yiladi.
     */
    static boolean isProtectedUrl(String url) {
        if (url == null) return false;
        String path;
        try {
            path = Uri.parse(url).getPath();
        } catch (Exception e) {
            return false;
        }
        if (path == null) return false;
        return path.contains("/dars/video") || path.startsWith("/student/videos");
    }

    /**
     * Bayroqni qo'yadi yoki olib tashlaydi.
     * Oynaning bayroqlarini faqat asosiy (UI) oqimda o'zgartirish mumkin,
     * aks holda Android istisno ko'taradi — shuning uchun runOnUiThread.
     * (UI oqimida turgan bo'lsak darhol bajariladi.)
     */
    static void apply(Activity activity, boolean secure) {
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            if (secure) {
                activity.getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        });
    }
}
