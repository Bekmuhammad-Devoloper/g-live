export const lessonLinkPath = (lessonId: string): string => `/l/${lessonId}`;

export function safeNextPath(v: unknown): string | null {
  return typeof v === "string" && /^\/l\/[A-Za-z0-9_-]{8,40}$/.test(v) ? v : null;
}

export const isNativeAppUa = (ua: string): boolean => /GermaniyaLiveApp\//.test(ua);
