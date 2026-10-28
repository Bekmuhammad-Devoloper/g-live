"use client";

import { useEffect, useState } from "react";

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
