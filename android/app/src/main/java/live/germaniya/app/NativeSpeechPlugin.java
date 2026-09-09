package live.germaniya.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
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
 *   · bepul kvota KUNIGA 20 ta so'rov — 125 o'quvchi uchun yetmaydi
 *   · 5 soniyalik yozuvga ~30 soniya javob kutilardi
 *   · noto'g'ri aytilganini "to'g'ri" deb o'tkazdi (o'ylab topishga moyil)
 *
 * Android esa nutqni O'ZI taniydi: bepul, kvotasiz, odatda bir soniyada va
 * yozuv hech qayerga yuborilmaydi. Nemis tili qo'llab-quvvatlanadi.
 *
 * IKKI YO'L, KETMA-KET:
 *
 *   1. SpeechRecognizer — ilova ichida, oynasiz. Eng qulay.
 *      Lekin ba'zi telefonlarda (Xiaomi va boshqa OEM qobiqlari) u ulanadi-yu,
 *      HECH QACHON tayyor bo'lmaydi: na natija, na xato — "Eshitilmoqda…"
 *      da osilib qoladi. Aynan shu kuzatildi (2.8.0, serverga bitta ham
 *      so'rov yetib kelmagan).
 *
 *   2. Shu sabab 4 soniyada `onReadyForSpeech` kelmasa — Google'ning o'z
 *      "Gapiring" oynasiga (ACTION_RECOGNIZE_SPEECH) o'tiladi. Bu oynani
 *      Google ilovasining o'zi boshqaradi va OEM qobiqlarida ancha ishonchli.
 *      Natija ActivityResult orqali qaytadi.
 *
 * Ikkalasi ham ishlamasa — sabab kodi bilan qaytadi ("err_nodialog",
 * "err_5"...). Veb tomon uni ekranda ko'rsatadi: qurilmaga kirib
 * bo'lmaydi, shu yagona diagnostika.
 */
@CapacitorPlugin(
    name = "NativeSpeech",
    permissions = { @Permission(alias = NativeSpeechPlugin.MIC, strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class NativeSpeechPlugin extends Plugin {

    static final String MIC = "mic";

    /** Shuncha vaqtda xizmat "tayyorman" demasa — oynali yo'lga o'tamiz */
    private static final long READY_MS = 4_000;
    /**
     * Umumiy chegara. Veb tomondagi 20 soniyadan KICHIK bo'lishi shart:
     * shunda sabab shu yerdan ("err_timeout") keladi, veb tomonning umumiy
     * "timeout" idan emas — birinchisi aniqroq.
     */
    private static final long WATCHDOG_MS = 18_000;

    private SpeechRecognizer recognizer;
    /** Ayni paytda kutilayotgan chaqiruv — bir vaqtda faqat bittasi */
    private PluginCall pending;
    private String locale = "de-DE";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable giveUp = () -> finishError("err_timeout");
    private final Runnable notReady = this::fallbackToDialog;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject res = new JSObject();
        boolean ok = false;
        try {
            ok = SpeechRecognizer.isRecognitionAvailable(getContext());
        } catch (Throwable ignored) {
            // Qurilmada xizmat yo'q yoki manifestda <queries> yo'q — false qoladi
        }
        res.put("available", ok);
        call.resolve(res);
    }

    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState(MIC) != PermissionState.GRANTED) {
            requestPermissionForAlias(MIC, call, "micResult");
            return;
        }
        start(call);
    }

    @PermissionCallback
    private void micResult(PluginCall call) {
        if (getPermissionState(MIC) != PermissionState.GRANTED) {
            fail(call, "denied");
            return;
        }
        start(call);
    }

    private void start(final PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            fail(call, "unavailable");
            return;
        }

        // SpeechRecognizer FAQAT asosiy oqimda yaratiladi va boshqariladi.
        // Butun blok try/catch ichida: istisno chiqsa chaqiruv javobsiz
        // qolib ketardi.
        activity.runOnUiThread(() -> {
            if (pending != null) {
                fail(call, "busy");
                return;
            }
            try {
                locale = call.getString("locale", "de-DE");
                release();
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                if (recognizer == null) {
                    // Ilova ichidagi yo'l umuman yo'q — to'g'ridan-to'g'ri oynaga
                    pending = call;
                    fallbackToDialog();
                    return;
                }

                pending = call;
                recognizer.setRecognitionListener(new Listener());

                handler.removeCallbacksAndMessages(null);
                handler.postDelayed(giveUp, WATCHDOG_MS);
                handler.postDelayed(notReady, READY_MS);
                recognizer.startListening(buildIntent(false));
            } catch (Throwable e) {
                handler.removeCallbacksAndMessages(null);
                pending = null;
                release();
                fail(call, "err_start");
            }
        });
    }

    private Intent buildIntent(boolean forDialog) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale);
        // Bir nechta variant: birinchisi boshqa so'z bo'lsa, qolganlarida topilishi mumkin
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        if (forDialog) {
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "So'zni nemischa ayting");
        } else {
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        }
        return intent;
    }

    /**
     * Ilova ichidagi tanish tayyor bo'lmadi — Google'ning o'z oynasiga o'tamiz.
     * Asosiy oqimda chaqiriladi (handler shu oqimda).
     */
    private void fallbackToDialog() {
        PluginCall call = pending;
        if (call == null) return;

        handler.removeCallbacksAndMessages(null);
        release();

        Intent intent = buildIntent(true);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            // Oynani ko'rsatadigan ilova ham yo'q (Google ilovasi o'chirilgan)
            pending = null;
            fail(call, "err_nodialog");
            return;
        }

        // Chaqiruv endi ActivityResult orqali yopiladi. `pending` bo'shatiladi:
        // oyna modal, WebView'ga bosib bo'lmaydi, ikkinchi chaqiruv kelmaydi.
        pending = null;
        try {
            startActivityForResult(call, intent, "dialogResult");
        } catch (Throwable e) {
            fail(call, "err_dialog_start");
        }
    }

    @ActivityCallback
    private void dialogResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            // Foydalanuvchi oynani yopdi yoki hech narsa demadi
            fail(call, "no_match");
            return;
        }
        ArrayList<String> list = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (list == null || list.isEmpty()) {
            fail(call, "no_match");
            return;
        }
        JSObject res = new JSObject();
        res.put("text", String.join(" | ", list));
        call.resolve(res);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) { call.resolve(); return; }
        activity.runOnUiThread(() -> {
            handler.removeCallbacks(notReady);
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
     * Xato ham `resolve` bilan qaytariladi (reject emas): veb tomonda sabab
     * kerak — "denied" bo'lsa ruxsat, "no_match" bo'lsa "eshitilmadi",
     * "err_*" bo'lsa ekranda kod.
     */
    private void fail(PluginCall call, String error) {
        JSObject res = new JSObject();
        res.put("error", error);
        call.resolve(res);
    }

    private void finish(String text) {
        handler.removeCallbacksAndMessages(null);
        PluginCall call = pending;
        pending = null;
        release();
        if (call == null) return;
        JSObject res = new JSObject();
        res.put("text", text);
        call.resolve(res);
    }

    private void finishError(String error) {
        handler.removeCallbacksAndMessages(null);
        PluginCall call = pending;
        pending = null;
        release();
        if (call != null) fail(call, error);
    }

    private class Listener implements RecognitionListener {
        @Override
        public void onReadyForSpeech(Bundle params) {
            // Xizmat tayyor — oynali yo'lga o'tish endi kerak emas
            handler.removeCallbacks(notReady);
        }

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
                    err = "no_match";
                    break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    err = "denied";
                    break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                    err = "network";
                    break;
                case 12: // ERROR_LANGUAGE_NOT_SUPPORTED
                case 13: // ERROR_LANGUAGE_UNAVAILABLE
                    err = "language";
                    break;
                case SpeechRecognizer.ERROR_CLIENT:
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                case SpeechRecognizer.ERROR_SERVER:
                case 11: // ERROR_SERVER_DISCONNECTED
                    // Ilova ichidagi yo'l nosoz — oynali yo'lni sinab ko'ramiz
                    fallbackToDialog();
                    return;
                default:
                    err = "err_" + code;
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
            // Barcha variantlar bitta qatorda: solishtirish ichidan mosini topadi
            finish(String.join(" | ", list));
        }
    }
}
