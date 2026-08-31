"use client";

import { useEffect } from "react";

// Xizmat ishchisini ro'yxatdan o'tkazadi — shu bilan ilova telefonga
// o'rnatiladigan bo'ladi (Android'da "Ilovani o'rnatish" taklifi chiqadi).

export default function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // ro'yxatdan o'tmasa ilova baribir ishlayveradi
      });
    }, 1200); // sahifa yuklanib bo'lgach — birinchi ochilish tezligiga xalaqit bermasin
    return () => clearTimeout(id);
  }, []);

  return null;
}
