"use client";

import { useEffect, useState } from "react";

// Sozlamalar sahifasining pastidagi versiya qatori.
//
// Ilgari bu yerda "1.1.0" qo'lda yozilgan edi va har yangilanishda eskirib
// qolardi — qo'llab-quvvatlashga "qaysi versiyada?" deb so'ralganda javob
// noto'g'ri chiqardi. Endi Android ilovasi o'z versiyasini O'ZIDAN o'qiydi
// (APK ichidagi versionName), brauzerda esa "veb" deb turadi.
//
// Aynan shu qator orqali "yangi APK o'rnatildimi yoki eskisi turibdimi"
// degan savolga bir qarashda javob olinadi.

export default function AppVersion({ label }: { label: string }) {
  const [text, setText] = useState<string>("…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) {
          if (!cancelled) setText("veb");
          return;
        }
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (!cancelled) setText(`${info.version} (${info.build})`);
      } catch {
        if (!cancelled) setText("—");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className="gl-selectable pb-2 text-center text-[11.5px] text-slate-500">
      {label} {text}
    </p>
  );
}
