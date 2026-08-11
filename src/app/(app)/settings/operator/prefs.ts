// Operator / ROP shaxsiy sozlamalari.
// Setting (key-value) jadvalida har bir foydalanuvchi uchun bitta JSON yozuv saqlanadi:
//   key = "operator.prefs.<userId>"
// Bu modul server (page.tsx, actions.ts) tomonidan ishlatiladi — "use server" yo'q,
// shuning uchun konstanta va oddiy funksiyalarni ham eksport qila oladi.

export type OperatorPrefs = {
  notifyEmail: boolean;   // email orqali bildirishnoma
  notifyPush: boolean;    // brauzer push bildirishnomasi
  notifySound: boolean;   // yangi bildirishnoma kelganda ovoz
  autoLogoutMinutes: number; // faoliyatsizlikdan keyin avtomatik chiqish (0 = hech qachon)
};

export const DEFAULT_PREFS: OperatorPrefs = {
  notifyEmail: true,
  notifyPush: true,
  notifySound: true,
  autoLogoutMinutes: 30,
};

export const AUTO_LOGOUT_OPTIONS: readonly number[] = [0, 15, 30, 60, 120];

export const prefsKey = (userId: string) => `operator.prefs.${userId}`;

const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);

// Saqlangan JSON qatorini xavfsiz o'qish — buzilgan bo'lsa standart qiymatlar qaytadi.
export function parsePrefs(raw: string | null): OperatorPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const mins = Number(o.autoLogoutMinutes);
    return {
      notifyEmail: bool(o.notifyEmail, DEFAULT_PREFS.notifyEmail),
      notifyPush: bool(o.notifyPush, DEFAULT_PREFS.notifyPush),
      notifySound: bool(o.notifySound, DEFAULT_PREFS.notifySound),
      autoLogoutMinutes: AUTO_LOGOUT_OPTIONS.includes(mins) ? mins : DEFAULT_PREFS.autoLogoutMinutes,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
