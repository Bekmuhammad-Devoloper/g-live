"use client";

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

export async function protectScreen(): Promise<void> {
  try {
    await (await get())?.enable();
  } catch {
  }
}

export async function unprotectScreen(): Promise<void> {
  try {
    await (await get())?.disable();
  } catch {
  }
}
