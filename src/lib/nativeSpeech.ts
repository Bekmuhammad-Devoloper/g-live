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

/**
 * Va'da berilgan vaqtda tugamasa — `fallback` bilan yakunlanadi.
 *
 * Native chaqiruv javobsiz qolishi mumkin (plagin ro'yxatdan o'tmagan,
 * ko'prik xabarni yo'qotgan, xizmat osilib qolgan). Bunday holatda va'da
 * HECH QACHON tugamaydi va ekranda hech narsa o'zgarmaydi — foydalanuvchi
 * uchun bu "tugma ishlamayapti" bo'lib ko'rinadi. Shu sabab har bir native
 * chaqiruvning muddati bor.
 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    p.then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } })
     .catch(() => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
  });
}

/** Aniqlangan javob — sahifadan sahifaga qayta so'ralmasin */
let cached: boolean | undefined;

/** Qurilmada nutq tanish bormi (brauzerda doim false) */
export async function nativeSpeechAvailable(): Promise<boolean> {
  if (cached !== undefined) return cached;
  try {
    const p = await get();
    if (!p) { cached = false; return false; }
    const r = await withTimeout(p.available(), 3000, { available: false });
    cached = !!r.available;
  } catch {
    // Eski APK da bu plagin yo'q — chaqiruv rad etiladi
    cached = false;
  }
  return cached;
}

export type NativeError = "denied" | "no_match" | "network" | "unavailable" | "busy";
export type NativeResult = { text: string } | { error: NativeError };

/**
 * Tinglaydi va eshitilgan matnni qaytaradi. `null` — bu yo'l umuman yo'q
 * (chaqiruvchi zaxira yo'lga o'tishi kerak).
 *
 * 20 soniya: odam so'zni aytib, tizim uni tanib ulgurishi uchun yetarli;
 * undan uzoq kutish esa "ilova qotib qoldi" degani.
 */
export async function listenNative(locale = "de-DE"): Promise<NativeResult | null> {
  try {
    const p = await get();
    if (!p) return null;
    const r = await withTimeout(p.listen({ locale }), 20_000, { error: "unavailable" as const });
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
