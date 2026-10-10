"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { devLogin, devLogout, requireDev, devAudit } from "@/lib/devpanel/auth";
import {
  readRegistry, writeRegistry, getCenter, updateCenter, nextPort, newSecret, writeCenterEnv,
  centerDb, centerDir, BASE_DOMAIN, APP_DIR, CENTERS_ROOT, type Center,
} from "@/lib/devpanel/registry";
import { glCenter, pushSchema, initCenterDb, prepareDirs, waitHealthy, resetUserPassword, setBrandName, type Step } from "@/lib/devpanel/ops";
import { ALL_INSTANCE_MODULES, type InstanceModule } from "@/lib/instance";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
const RESERVED = new Set(["dev", "www", "sip", "mail", "api", "admin", "app", "germaniya", "static"]);
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addMonths = (from: Date, n: number) => { const d = new Date(from); d.setMonth(d.getMonth() + n); return d; };
const strongPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export async function loginAction(_: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const r = await devLogin(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error === "too_many" ? "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." : "Email yoki parol noto'g'ri." };
  redirect("/dev");
}

export async function logoutAction(): Promise<void> {
  await devLogout();
  redirect("/dev/login");
}

// ─── Markaz yaratish ───
export interface CreateResult { ok: boolean; error?: string; steps?: Step[]; slug?: string; director?: { email: string; password: string }; url?: string }

export async function createCenterAction(input: {
  name: string; slug: string; directorName: string; directorEmail: string; directorPhone: string; directorPassword: string;
  months: number; plan: string; modules: string[]; contactName: string; contactPhone: string; notes: string;
}): Promise<CreateResult> {
  const dev = await requireDev();
  const name = input.name.trim().slice(0, 80);
  const slug = input.slug.trim().toLowerCase();
  const email = input.directorEmail.trim().toLowerCase();
  const password = input.directorPassword.trim() || strongPassword();
  if (name.length < 2) return { ok: false, error: "Markaz nomini kiriting" };
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return { ok: false, error: "Subdomen: 2–31 ta kichik lotin harf, raqam yoki chiziqcha (band nomlar mumkin emas)" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Direktor emailini to'g'ri kiriting" };
  if (input.directorName.trim().length < 2) return { ok: false, error: "Direktor ismini kiriting" };
  if (password.length < 8) return { ok: false, error: "Parol kamida 8 belgi bo'lsin" };

  const reg = await readRegistry();
  if (reg.centers.some((c) => c.slug === slug && c.status !== "deleted")) return { ok: false, error: "Bu subdomen band" };
  const enabled = new Set(input.modules);
  const center: Center = {
    slug, name, host: `${slug}.${BASE_DOMAIN}`, port: nextPort(reg), createdAt: new Date().toISOString(),
    licenseUntil: isoDate(addMonths(new Date(), Math.min(Math.max(Math.trunc(input.months) || 1, 1), 36))),
    suspended: false,
    disabledModules: ALL_INSTANCE_MODULES.filter((m) => !enabled.has(m)),
    plan: input.plan.trim().slice(0, 40) || "Standart",
    contactName: input.contactName.trim().slice(0, 80), contactPhone: input.contactPhone.trim().slice(0, 30), notes: input.notes.trim().slice(0, 1000),
    directorEmail: email, authSecret: newSecret(), status: "provisioning", lastError: null,
  };
  reg.centers = reg.centers.filter((c) => c.slug !== slug).concat(center);
  await writeRegistry(reg);
  await devAudit("center_create_start", { by: dev.email, slug, name });

  const steps: Step[] = [];
  const fail = async (msg: string) => {
    await updateCenter(slug, { status: "failed", lastError: msg });
    await devAudit("center_create_failed", { by: dev.email, slug, error: msg });
    revalidatePath("/dev");
    return { ok: false, error: msg, steps, slug };
  };

  try {
    await prepareDirs(slug);
    await writeCenterEnv(center);
    steps.push({ step: "Papkalar va sozlamalar", ok: true });
  } catch (e) {
    steps.push({ step: "Papkalar va sozlamalar", ok: false, detail: String(e) });
    return fail("Papka yaratib bo'lmadi");
  }

  const schema = await pushSchema(slug); steps.push(schema);
  if (!schema.ok) return fail("Baza yaratilmadi");

  const init = await initCenterDb(center, { name: input.directorName.trim(), email, password, phone: input.directorPhone.trim() });
  steps.push(init);
  if (!init.ok) return fail("Direktor hisobi yaratilmadi");

  const svc = await glCenter("enable", slug);
  steps.push({ step: "Xizmat ishga tushdi", ok: svc.ok, detail: svc.ok ? undefined : svc.out });
  if (!svc.ok) return fail("Xizmat ishga tushmadi");

  const healthy = await waitHealthy(center.port, 90_000);
  steps.push({ step: "Markaz javob beryapti", ok: healthy });

  const site = await glCenter("site", slug, String(center.port), center.host);
  const certOk = site.ok && !/fail|error|problem/i.test(site.out);
  steps.push({ step: "Subdomen va SSL", ok: certOk, detail: certOk ? undefined : `${site.out.slice(0, 300)} — DNS'da *.${BASE_DOMAIN} yozuvi borligini tekshiring, keyin markaz sahifasidan "SSL ni qayta olish"` });

  await updateCenter(slug, { status: healthy ? "active" : "failed", lastError: healthy ? (certOk ? null : "SSL olinmadi") : "Markaz javob bermadi" });
  await devAudit("center_created", { by: dev.email, slug, name, port: center.port, ssl: certOk });
  revalidatePath("/dev");
  return { ok: healthy, steps, slug, director: { email, password }, url: `https://${center.host}` };
}

// ─── Boshqaruv amallari ───
async function mutate(slug: string, patch: Partial<Center>, action: string, extra: Record<string, unknown> = {}): Promise<{ ok: boolean; error?: string }> {
  const dev = await requireDev();
  const c = await updateCenter(slug, patch);
  if (!c) return { ok: false, error: "Markaz topilmadi" };
  await writeCenterEnv(c);
  const r = c.status === "deleted" ? { ok: true, out: "" } : await glCenter("restart", slug);
  await devAudit(action, { by: dev.email, slug, ...extra });
  revalidatePath("/dev"); revalidatePath(`/dev/centers/${slug}`);
  return r.ok ? { ok: true } : { ok: false, error: r.out };
}

export async function extendLicenseAction(slug: string, months: number): Promise<{ ok: boolean; error?: string }> {
  const c = await getCenter(slug); if (!c) return { ok: false, error: "Markaz topilmadi" };
  const base = new Date(c.licenseUntil + "T12:00:00") > new Date() ? new Date(c.licenseUntil + "T12:00:00") : new Date();
  const until = isoDate(addMonths(base, Math.min(Math.max(Math.trunc(months), 1), 36)));
  return mutate(slug, { licenseUntil: until }, "license_extend", { months, until });
}

export async function setLicenseDateAction(slug: string, date: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Sana noto'g'ri" };
  return mutate(slug, { licenseUntil: date }, "license_set", { until: date });
}

export async function setSuspendedAction(slug: string, suspended: boolean, reason: string): Promise<{ ok: boolean; error?: string }> {
  return mutate(slug, { suspended }, suspended ? "center_suspend" : "center_resume", { reason: reason.slice(0, 300) });
}

export async function setModulesAction(slug: string, enabled: string[]): Promise<{ ok: boolean; error?: string }> {
  const on = new Set(enabled);
  const disabledModules = ALL_INSTANCE_MODULES.filter((m) => !on.has(m)) as InstanceModule[];
  return mutate(slug, { disabledModules }, "modules_set", { disabled: disabledModules });
}

export async function updateInfoAction(slug: string, info: { name: string; plan: string; contactName: string; contactPhone: string; notes: string }): Promise<{ ok: boolean; error?: string }> {
  const c = await getCenter(slug); if (!c) return { ok: false, error: "Markaz topilmadi" };
  const name = info.name.trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Nom juda qisqa" };
  if (name !== c.name) { try { await setBrandName(centerDb(slug), name); } catch { /* baza band bo'lsa keyingi safar */ } }
  return mutate(slug, {
    name, plan: info.plan.trim().slice(0, 40), contactName: info.contactName.trim().slice(0, 80),
    contactPhone: info.contactPhone.trim().slice(0, 30), notes: info.notes.trim().slice(0, 1000),
  }, "center_info", { name });
}

export async function resetDirectorPasswordAction(slug: string): Promise<{ ok: boolean; error?: string; password?: string; email?: string }> {
  const dev = await requireDev();
  const c = await getCenter(slug); if (!c) return { ok: false, error: "Markaz topilmadi" };
  const password = strongPassword();
  const ok = await resetUserPassword(centerDb(slug), c.directorEmail, password);
  await devAudit("director_password_reset", { by: dev.email, slug, ok });
  return ok ? { ok: true, password, email: c.directorEmail } : { ok: false, error: "Direktor topilmadi (email o'zgartirilgan bo'lishi mumkin)" };
}

export async function serviceAction(slug: string, op: "start" | "stop" | "restart"): Promise<{ ok: boolean; error?: string }> {
  const dev = await requireDev();
  const r = await glCenter(op, slug);
  await devAudit(`service_${op}`, { by: dev.email, slug, ok: r.ok });
  revalidatePath(`/dev/centers/${slug}`); revalidatePath("/dev");
  return r.ok ? { ok: true } : { ok: false, error: r.out };
}

export async function retrySslAction(slug: string): Promise<{ ok: boolean; error?: string }> {
  const dev = await requireDev();
  const c = await getCenter(slug); if (!c) return { ok: false, error: "Markaz topilmadi" };
  const r = await glCenter("site", slug, String(c.port), c.host);
  const ok = r.ok && !/fail|error|problem/i.test(r.out);
  if (ok && c.lastError === "SSL olinmadi") await updateCenter(slug, { lastError: null });
  await devAudit("ssl_retry", { by: dev.email, slug, ok });
  revalidatePath(`/dev/centers/${slug}`);
  return ok ? { ok: true } : { ok: false, error: r.out.slice(0, 400) };
}

export async function backupAction(slug: string): Promise<{ ok: boolean; error?: string }> {
  const dev = await requireDev();
  const r = await glCenter("backup", slug);
  await devAudit("backup", { by: dev.email, slug, ok: r.ok });
  revalidatePath(`/dev/centers/${slug}`);
  return r.ok ? { ok: true } : { ok: false, error: r.out };
}

/** O'chirish: xizmat to'xtatiladi, subdomen olib tashlanadi; ma'lumotlar papkasi arxivga (o'chirilmaydi) */
export async function deleteCenterAction(slug: string, confirm: string): Promise<{ ok: boolean; error?: string }> {
  const dev = await requireDev();
  if (confirm !== slug) return { ok: false, error: "Tasdiqlash uchun subdomenni aynan yozing" };
  const c = await getCenter(slug); if (!c) return { ok: false, error: "Markaz topilmadi" };
  await glCenter("disable", slug);
  await glCenter("unsite", slug);
  const archived = path.join(CENTERS_ROOT, `.deleted-${slug}-${Date.now()}`);
  try { await fs.rename(centerDir(slug), archived); } catch { /* papka yo'q */ }
  const reg = await readRegistry();
  reg.centers = reg.centers.map((x) => (x.slug === slug ? { ...x, status: "deleted" as const, lastError: `Arxiv: ${archived}` } : x));
  await writeRegistry(reg);
  await devAudit("center_delete", { by: dev.email, slug, archived });
  revalidatePath("/dev");
  return { ok: true };
}

/** Hamma markazni joriy kodga moslash: sxema + qayta ishga tushirish (deploy'dan keyin avtomatik ham bajariladi) */
export async function updateAllAction(): Promise<{ ok: boolean; results: { slug: string; ok: boolean; detail?: string }[] }> {
  const dev = await requireDev();
  const reg = await readRegistry();
  const results: { slug: string; ok: boolean; detail?: string }[] = [];
  for (const c of reg.centers.filter((x) => x.status === "active" || x.status === "failed")) {
    const s = await pushSchema(c.slug);
    const r = s.ok ? await glCenter("restart", c.slug) : { ok: false, out: s.detail ?? "" };
    results.push({ slug: c.slug, ok: s.ok && r.ok, detail: s.ok ? (r.ok ? undefined : r.out) : s.detail });
  }
  await devAudit("update_all", { by: dev.email, results: results.map((r) => `${r.slug}:${r.ok ? "ok" : "xato"}`) });
  revalidatePath("/dev");
  return { ok: results.every((r) => r.ok), results };
}

/** Asosiy markaz (germaniya.live) litsenziyasi — /opt/gl-edu/.env dagi SUBSCRIPTION_UNTIL */
export async function setMainLicenseAction(date: string): Promise<{ ok: boolean; error?: string }> {
  const dev = await requireDev();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Sana noto'g'ri" };
  const envPath = path.join(APP_DIR, ".env");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    const next = /^SUBSCRIPTION_UNTIL=.*$/m.test(raw) ? raw.replace(/^SUBSCRIPTION_UNTIL=.*$/m, `SUBSCRIPTION_UNTIL="${date}"`) : `${raw.trimEnd()}\nSUBSCRIPTION_UNTIL="${date}"\n`;
    await fs.writeFile(envPath, next);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
  const r = await glCenter("main-restart");
  await devAudit("main_license_set", { by: dev.email, until: date, restarted: r.ok });
  revalidatePath("/dev");
  return r.ok ? { ok: true } : { ok: false, error: `Sana yozildi, lekin qayta ishga tushmadi: ${r.out}` };
}
