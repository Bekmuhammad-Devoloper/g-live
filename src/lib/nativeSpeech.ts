"use client";

// Androidning o'z nutq tanish tizimi (NativeSpeechPlugin.java).
//
// Talaffuz bosqichi shu orqali ishlaydi: bepul, kvotasiz, odatda bir
// soniyada va o'quvchining ovozi telefondan umuman chiqmaydi.
//
// Brauzerda yoki xizmat topilmagan telefonda `listenNative` `null`
// qaytaradi — chaqiruvchi o'shanda eski yo'lga (yozib olib, serverga
// yuborish) qaytadi.

interface NativeSpeech {
  available(): Promise<{ available?: boolean }>;
  listen(options: { locale: string }): Promise<{ text?: string; error?: string }>;
  stop(): Promise<void>;
}

let plugin: NativeSpeech | null | undefined;

async function get(): Promise<NativeSpeech | null> {
  if (plugin !== undefined) return plugin;
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    plugin = Capacitor.isNativePlatform() ? registerPlugin<NativeSpeech>("NativeSpeech") : null;
  } catch {
    plugin = null;
  }
  return plugin;
}

/** Qurilmada nutq tanish bormi (brauzerda doim false) */
export async function nativeSpeechAvailable(): Promise<boolean> {
  try {
    const p = await get();
    if (!p) return false;
    return !!(await p.available()).available;
  } catch {
    // Eski APK da bu plagin yo'q — chaqiruv rad etiladi
    return false;
  }
}

export type NativeError = "denied" | "no_match" | "network" | "unavailable" | "busy";
export type NativeResult = { text: string } | { error: NativeError };

/** Tinglaydi va eshitilgan matnni qaytaradi. `null` — bu yo'l umuman yo'q. */
export async function listenNative(locale = "de-DE"): Promise<NativeResult | null> {
  try {
    const p = await get();
    if (!p) return null;
    const r = await p.listen({ locale });
    if (r.error) return { error: r.error as NativeError };
    return { text: r.text ?? "" };
  } catch {
    return null;
  }
}

/** Tinglashni to'xtatadi (foydalanuvchi tugmani qayta bosganda) */
export async function stopNative(): Promise<void> {
  try {
    await (await get())?.stop();
  } catch {
    /* muhim emas */
  }
}
