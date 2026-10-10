// Markaz nusxasi (instance) sozlamalari — har bir o'quv markazi bir xil kod bilan, lekin o'z
// jarayoni, bazasi, fayllari va sozlamalari bilan ishlaydi. Sozlamalar jarayon muhitidan
// (systemd EnvironmentFile) o'qiladi va Dev paneldan boshqariladi:
//   GL_INSTANCE          — markaz identifikatori (subdomen), asosiy markaz uchun bo'sh
//   SUBSCRIPTION_UNTIL   — litsenziya tugash sanasi (yyyy-mm-dd); o'tib ketsa tizim yopiladi
//   GL_SUSPENDED=1       — markaz to'xtatilgan (to'lov qilinmagan va h.k.)
//   GL_DISABLED_MODULES  — o'chirilgan modullar, vergul bilan (masalan "telephony,market")
//   DEV_PANEL=1          — bu jarayon Dev panel (markazlar boshqaruvi), o'quv markazi emas
// Muhit o'zgaruvchilari ISHGA TUSHISHDA o'qiladi — shu sabab ildiz maket force-dynamic.

export type InstanceModule = "crm" | "telephony" | "finance" | "lms" | "student_app" | "market" | "control" | "marketing";

/** Modullar: nomi va shu modulga tegishli sahifa yo'llari (menyu va sahifa himoyasi shular bo'yicha) */
export const INSTANCE_MODULES: Record<InstanceModule, { uz: string; ru: string; desc: string; paths: string[] }> = {
  crm: { uz: "CRM (lidlar)", ru: "CRM (лиды)", desc: "Lidlar doskasi, ariza formasi, operator va ROP portallari", paths: ["/crm", "/apply", "/daraja-testi", "/operator", "/rop"] },
  telephony: { uz: "Telefoniya", ru: "Телефония", desc: "Brauzer softfoni, qo'ng'iroqlar tarixi va yozuvlari", paths: ["/calls"] },
  finance: { uz: "Moliya", ru: "Финансы", desc: "To'lovlar, qarzdorlar, xarajatlar, ish haqi, promokodlar", paths: ["/finance", "/payments"] },
  lms: { uz: "O'quv bo'limi (LMS)", ru: "Учебный раздел (LMS)", desc: "Kurslar, video darslar, blok testlar, uy vazifalari", paths: ["/education", "/tests", "/courses", "/homework", "/assignments"] },
  student_app: { uz: "O'quvchi ilovasi", ru: "Приложение ученика", desc: "O'quvchi va ota-ona kabineti, mobil ilova", paths: ["/student", "/app", "/ilova"] },
  market: { uz: "Reyting va do'kon", ru: "Рейтинг и магазин", desc: "Tangalar, yulduzlar, sovg'alar do'koni", paths: ["/market", "/rating"] },
  control: { uz: "Nazorat", ru: "Контроль", desc: "Nazorat paneli, o'qituvchilar davomati", paths: ["/control", "/teacher-attendance"] },
  marketing: { uz: "Marketing", ru: "Маркетинг", desc: "Marketing bo'limi va vakansiyalar", paths: ["/marketing", "/vacancies"] },
};
export const ALL_INSTANCE_MODULES = Object.keys(INSTANCE_MODULES) as InstanceModule[];

export const isDevPanel = (): boolean => process.env.DEV_PANEL === "1";
export const instanceSlug = (): string => process.env.GL_INSTANCE || "";

export function disabledModules(): Set<InstanceModule> {
  const raw = String(process.env.GL_DISABLED_MODULES ?? "");
  return new Set(raw.split(",").map((x) => x.trim()).filter((x): x is InstanceModule => x in INSTANCE_MODULES));
}
export const isModuleEnabled = (m: InstanceModule): boolean => !disabledModules().has(m);

/** Yo'l o'chirilgan modulga tegishlimi ("/finance/payments" → finance o'chirilgan bo'lsa false) */
export function isPathEnabled(pathname: string): boolean {
  const off = disabledModules();
  if (off.size === 0) return true;
  for (const m of off) {
    for (const p of INSTANCE_MODULES[m].paths) if (pathname === p || pathname.startsWith(p + "/")) return false;
  }
  return true;
}

export interface BlockState {
  blocked: boolean;
  reason: "suspended" | "expired" | null;
  until: string | null;
}

/** Markaz yopilganmi: to'xtatilgan yoki litsenziya muddati o'tgan (tugash kuni oxirigacha ishlaydi) */
export function instanceBlockState(now = new Date()): BlockState {
  const until = process.env.SUBSCRIPTION_UNTIL?.trim() || null;
  if (process.env.GL_SUSPENDED === "1") return { blocked: true, reason: "suspended", until };
  if (until && /^\d{4}-\d{2}-\d{2}$/.test(until)) {
    const end = new Date(until + "T23:59:59");
    if (!isNaN(end.getTime()) && now.getTime() > end.getTime()) return { blocked: true, reason: "expired", until };
  }
  return { blocked: false, reason: null, until };
}
