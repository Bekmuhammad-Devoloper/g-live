export type OperatorPrefs = {
  notifyEmail: boolean;
  notifyPush: boolean;
  notifySound: boolean;
  autoLogoutMinutes: number;
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
