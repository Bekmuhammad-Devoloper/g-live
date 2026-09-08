package live.germaniya.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * Androidning O'Z nutq tanish tizimi — lug'at mashqining talaffuz bosqichi
 * uchun.
 *
 * NEGA KERAK BO'LDI. Dastlab talaffuz Gemini orqali tekshirilardi: yozuv
 * serverga yuborilib, u yerdan matnga o'girilardi. Amalda bu ishlamadi:
 *   · bepul kvota KUNIGA 20 ta so'rov (GenerateRequestsPerDayPerProject
 *     ModelFreeTier, quotaValue 20). Bitta o'quvchi bitta darsni mashq
 *     qilsa 10 tasi ketadi — 125 o'quvchi uchun mutlaqo yetmaydi.
 *   · 5 soniyalik yozuvga ~30 soniya javob kutilardi
 *   · "gemini-flash-latest" doimiy 503 "high demand" qaytarardi
 *
 * Android esa nutqni O'ZI taniydi: bepul, kvotasiz, odatda bir soniyada va
 * yozuv hech qayerga yuborilmaydi (o'quvchining ovozi telefondan
 * chiqmaydi). Nemis tili qo'llab-quvvatlanadi.
 *
 * Xizmat topilmasa (ba'zi telefonlarda Google ilovasi yo'q) `available`
 * false qaytadi va veb tomon eski yo'lga — Gemini ga qaytadi.
 */
@CapacitorPlugin(
    name = "NativeSpeech",
    permissions = { @Permission(alias = NativeSpeechPlugin.MIC, strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class NativeSpeechPlugin extends Plugin {

    static final String MIC = "mic";

    private SpeechRecognizer recognizer;
    /** Ayni paytda kutilayotgan chaqiruv — bir vaqtda faqat bittasi */
    private PluginCall pending;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject res = new JSObject();
        boolean ok = false;
        try {
            ok = SpeechRecognizer.isRecognitionAvailable(getContext());
        } catch (Throwable ignored) {
            // Qurilmada xizmat yo'q yoki manifestda <queries> e'lon
            // qilinmagan (Android 11+) — false qoladi va veb tomon zaxira
            // yo'lga o'tadi.
        }
        res.put("available", ok);
        call.resolve(res);
    }

    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState(MIC) != com.getcapacitor.PermissionState.GRANTED) {
            // Ruxsat so'raymiz va javob kelgach shu chaqiruvni davom ettiramiz
            requestPermissionForAlias(MIC, call, "micResult");
            return;
        }
        start(call);
    }

    @PermissionCallback
    private void micResult(PluginCall call) {
        if (getPermissionState(MIC) != com.getcapacitor.PermissionState.GRANTED) {
            fail(call, "denied");
            return;
        }
        start(call);
    }

    /**
     * Nutq tanish xizmati javob bermay qolsa — shuncha vaqtdan keyin
     * chaqiruv baribir yopiladi.
     *
     * ZARUR: PluginCall javobsiz qolsa veb tomondagi va'da HECH QACHON
     * tugamaydi, ekranda hech narsa o'zgarmaydi va `pending` band qolgani
     * uchun keyingi bosishlar ham "busy" bo'lib qaytadi — foydalanuvchi
     * uchun bu "tugma butunlay ishlamay qoldi" demakdir.
     */
    private static final long WATCHDOG_MS = 25_000;
    private final android.os.Handler watchdog = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable giveUp = () -> finishError("unavailable");

    private void start(final PluginCall call) {
        final android.app.Activity activity = getActivity();
        if (activity == null) {
            fail(call, "unavailable");
            return;
        }

        // SpeechRecognizer FAQAT asosiy oqimda yaratiladi va boshqariladi.
        // Butun blok try/catch ichida: bu yerda kutilmagan istisno chiqsa
        // chaqiruv javobsiz qolib ketardi.
        activity.runOnUiThread(() -> {
            if (pending != null) {
                fail(call, "busy");
                return;
            }
            try {
                release();
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                if (recognizer == null) {
                    fail(call, "unavailable");
                    return;
                }

                pending = call;
                recognizer.setRecognitionListener(new Listener());

                String locale = call.getString("locale", "de-DE");
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale);
                // Bir nechta variant: o'quvchi to'g'ri aytgan bo'lsa-yu, birinchi
                // variant boshqa so'z bo'lsa, qolganlarida topilishi mumkin.
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
                intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());

                watchdog.removeCallbacks(giveUp);
                watchdog.postDelayed(giveUp, WATCHDOG_MS);
                recognizer.startListening(intent);
            } catch (Throwable e) {
                watchdog.removeCallbacks(giveUp);
                pending = null;
                release();
                fail(call, "unavailable");
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) {
                try { recognizer.stopListening(); } catch (Exception ignored) {}
            }
            call.resolve();
        });
    }

    private void release() {
        if (recognizer == null) return;
        try { recognizer.destroy(); } catch (Exception ignored) {}
        recognizer = null;
    }

    /**
     * Xato ham `resolve` bilan qaytariladi (reject emas).
     *
     * Veb tomonda reject qilingan va'da `catch` ga tushib, sababi yo'qoladi;
     * bu yerda esa sabab kerak: "denied" bo'lsa ruxsat so'raladi,
     * "unavailable" bo'lsa Gemini ga qaytiladi, "no_match" bo'lsa esa
     * o'quvchiga "eshitilmadi" deyiladi.
     */
    private void fail(PluginCall call, String error) {
        JSObject res = new JSObject();
        res.put("error", error);
        call.resolve(res);
    }

    private void finish(String text) {
        watchdog.removeCallbacks(giveUp);
        PluginCall call = pending;
        pending = null;
        release();
        if (call == null) return;
        JSObject res = new JSObject();
        res.put("text", text);
        call.resolve(res);
    }

    private void finishError(String error) {
        watchdog.removeCallbacks(giveUp);
        PluginCall call = pending;
        pending = null;
        release();
        if (call != null) fail(call, error);
    }

    private class Listener implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}
        @Override public void onPartialResults(Bundle partialResults) {}

        @Override
        public void onError(int code) {
            String err;
            switch (code) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    err = "no_match";      // ovoz eshitilmadi yoki tanilmadi
                    break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    err = "denied";
                    break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                    err = "network";
                    break;
                default:
                    err = "unavailable";   // xizmat band yoki nosoz
            }
            finishError(err);
        }

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (list == null || list.isEmpty()) {
                finishError("no_match");
                return;
            }
            // Barcha variantlar bitta qatorda: solishtirish ularning
            // ichidan mos kelganini topadi (lib/pronounce.ts so'zlarga
            // ajratib qaraydi).
            finish(String.join(" | ", list));
        }
    }
}
