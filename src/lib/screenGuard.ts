"use client";

// Dars videosini yozib olish va skrinshot qilishdan himoya.
//
// Android tomonda buni FLAG_SECURE qiladi (ScreenGuardPlugin.java). Bu
// yerda faqat shu plaginni chaqiramiz.
//
// Brauzerda ISHLAMAYDI va ishlashi ham mumkin emas: veb sahifa qurilmaning
// skrinshotini to'sa olmaydi. Shu sabab chaqiruvlar jimgina e'tiborsiz
// qoldiriladi — brauzerdan kirgan o'quvchi uchun hech narsa buzilmaydi.
//
// Himoya butun oynaga tegishli, shuning uchun uni faqat video ochilganda
// yoqamiz: o'quvchi natijasini yoki guvohnomasini skrinshot qilib
// do'stiga yubora olishi kerak.

let plugin: { enable(): Promise<void>; disable(): Promise<void> } | null | undefined;

async function get() {
  if (plugin !== undefined) return plugin;
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    plugin = Capacitor.isNativePlatform()
      ? registerPlugin<{ enable(): Promise<void>; disable(): Promise<void> }>("ScreenGuard")
      : null;
  } catch {
    plugin = null;
  }
  return plugin;
}

/** Skrinshot va ekran yozuvini to'sadi (faqat Android ilovasida) */
export async function protectScreen(): Promise<void> {
  try {
    await (await get())?.enable();
  } catch {
    /* plagin yo'q yoki eski APK — himoyasiz davom etadi */
  }
}

/** Himoyani olib tashlaydi */
export async function unprotectScreen(): Promise<void> {
  try {
    await (await get())?.disable();
  } catch {
    /* yuqoridagi kabi */
  }
}
