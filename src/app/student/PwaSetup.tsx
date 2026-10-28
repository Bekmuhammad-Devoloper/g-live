"use client";

import { useEffect } from "react";

export default function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      });
    }, 1200);
    return () => clearTimeout(id);
  }, []);

  return null;
}
