"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Bir marta va ikki marta bosishni ajratadi:
 *   1 marta bosish  -> yonboshdan tezkor ko'rish oynasi
 *   2 marta bosish  -> to'liq sahifaning ichiga kirish
 *
 * Brauzer ikki marta bosilganda ham avval ikkita oddiy "click" yuboradi,
 * shuning uchun yagona bosishning amali qisqa muddatga kechiktiriladi.
 * Shu oraliqda "dblclick" kelsa — kechiktirilgan amal bekor qilinadi va
 * faqat to'liq sahifa ochiladi (oyna ko'z oldida lip-lip qilmaydi).
 */
export function useDoubleClickOpen(delay = 220) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Komponent yopilsa kutib turgan amal ishlamasin
  useEffect(() => cancel, [cancel]);

  /** Bir marta bosish — kechiktirilgan holda bajariladi */
  const single = useCallback(
    (fn: () => void) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        fn();
      }, delay);
    },
    [cancel, delay],
  );

  /** Ikki marta bosish — darhol, kutib turganini bekor qilib */
  const double = useCallback(
    (fn: () => void) => {
      cancel();
      fn();
    },
    [cancel],
  );

  return { single, double, cancel };
}
