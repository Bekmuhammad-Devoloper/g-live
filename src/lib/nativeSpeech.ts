"use client";

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

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    p.then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } })
     .catch(() => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
  });
}

export async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let cached: boolean | undefined;

export async function nativeSpeechAvailable(): Promise<boolean> {
  if (cached !== undefined) return cached;
  try {
    const p = await get();
    if (!p) { cached = false; return false; }
    const r = await withTimeout(p.available(), 3000, { available: false });
    cached = !!r.available;
  } catch {
    cached = false;
  }
  return cached;
}

export type NativeError = "denied" | "no_match" | "network" | "unavailable" | "busy" | "language" | (string & {});
export type NativeResult = { text: string } | { error: NativeError };

export async function listenNative(locale = "de-DE"): Promise<NativeResult | null> {
  try {
    const p = await get();
    if (!p) return null;
    const r = await withTimeout(p.listen({ locale }), 20_000, { error: "timeout" as const });
    if (r.error) return { error: r.error as NativeError };
    return { text: r.text ?? "" };
  } catch {
    return null;
  }
}

export async function stopNative(): Promise<void> {
  try {
    await (await get())?.stop();
  } catch {
  }
}
