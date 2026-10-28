"use client";

import { useCallback, useEffect, useRef } from "react";

export function useDoubleClickOpen(delay = 220) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

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

  const double = useCallback(
    (fn: () => void) => {
      cancel();
      fn();
    },
    [cancel],
  );

  return { single, double, cancel };
}
