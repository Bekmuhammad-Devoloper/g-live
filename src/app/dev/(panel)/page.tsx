import Link from "next/link";
import path from "node:path";
import { promises as fs } from "node:fs";
import { readRegistry, centerDb, centerDir, APP_DIR, BASE_DOMAIN } from "@/lib/devpanel/registry";
import { centerStats, health, serverStats, appVersion, type CenterStats } from "@/lib/devpanel/ops";
import { ALL_INSTANCE_MODULES } from "@/lib/instance";
import { Card, Stat, Pill, LicensePill, fmtBytes, fmtMoney, fmtDate, daysLeft } from "./ui";
import { UpdateAllButton, MainLicenseForm } from "./DashboardControls";

export const dynamic = "force-dynamic";

async function mainLicense(): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(APP_DIR, ".env"), "utf8");
    return raw.match(/^SUBSCRIPTION_UNTIL="?([0-9-]+)"?/m)?.[1] ?? null;
  } catch { return null; }
}

export default async function DevDashboard() {
  const reg = await readRegistry();
  const centers = reg.centers.filter((c) => c.status !== "deleted");
  const [rows, main, srv, version, mainUntil] = await Promise.all([
    Promise.all(centers.map(async (c) => ({
      c,
      up: await health(c.port, 2500),
      stats: await centerStats(centerDb(c.slug), path.join(centerDir(c.slug), "uploads")),
    }))),
    (async () => ({ up: await health(3000, 2500), stats: await centerStats(path.join(APP_DIR, "prisma", "dev.db"), path.join(APP_DIR, "public", "uploads")) }))(),
    serverStats(),
    appVersion(),
    mainLicense(),
  ]);

  const all: (CenterStats | null)[] = [main.stats, ...rows.map((r) => r.stats)];
  const totalStudents = all.reduce((n, s) => n + (s?.activeStudents ?? 0), 0);
  const totalPaid = all.reduce((n, s) => n + (s?.paidThisMonth ?? 0), 0);
  const expiring = centers.filter((c) => { const d = daysLeft(c.licenseUntil); return d !== null && d <= 14; }).length;
  const suspended = centers.filter((c) => c.suspended).length;
  const memPct = srv.mem_total ? Math.round((+srv.mem_used / +srv.mem_total) * 100) : 0;
  const diskPct = srv.disk_total ? Math.round((+srv.disk_used / +srv.disk_total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">O'quv markazlari</h1>
          <p className="mt-1 text-sm text-slate-500">Versiya: {version}</p>
        </div>
        <div className="flex gap-2">
          <UpdateAllButton />
          <Link href="/dev/centers/new" className="rounded-lg bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] text-white shadow-lg shadow-orange-600/20 hover:brightness-110 px-4 py-2 text-sm font-semibold text-white ">+ Yangi markaz</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Markazlar" value={centers.length + 1} hint={`${rows.filter((r) => r.up).length + (main.up ? 1 : 0)} tasi ishlayapti`} />
        <Stat label="Faol o'quvchilar" value={totalStudents.toLocaleString("ru-RU")} hint="Barcha markazlarda" tone="blue" />
        <Stat label="Shu oy tushum" value={fmtMoney(totalPaid)} hint="Markazlar to'lovlari yig'indisi" tone="green" />
        <Stat label="E'tibor talab" value={expiring + suspended} hint={`${expiring} ta muddati yaqin · ${suspended} ta to'xtatilgan`} tone={expiring + suspended ? "amber" : "slate"} />
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-white/[0.03]">
              <tr>
                <th className="px-4 py-3">Markaz</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3">Litsenziya</th>
                <th className="px-4 py-3">Modullar</th>
                <th className="px-4 py-3 text-right">O'quvchi</th>
                <th className="px-4 py-3 text-right">Xodim</th>
                <th className="px-4 py-3 text-right">Shu oy tushum</th>
                <th className="px-4 py-3 text-right">Hajm</th>
                <th className="px-4 py-3">Oxirgi kirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              <tr className="bg-slate-50/50 dark:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-semibold">Germaniya Live <Pill tone="blue">asosiy</Pill></div>
                  <a href={`https://${BASE_DOMAIN}`} target="_blank" className="text-xs text-slate-500 hover:underline">{BASE_DOMAIN}</a>
                </td>
                <td className="px-4 py-3">{main.up ? <Pill tone="green">● Ishlayapti</Pill> : <Pill tone="red">● Javob yo'q</Pill>}</td>
                <td className="px-4 py-3"><LicensePill until={mainUntil} /><MainLicenseForm current={mainUntil} /></td>
                <td className="px-4 py-3 text-slate-500">Hammasi</td>
                <td className="px-4 py-3 text-right tabular-nums">{main.stats?.activeStudents ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{main.stats?.staff ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{main.stats ? fmtMoney(main.stats.paidThisMonth) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{main.stats ? fmtBytes(main.stats.dbBytes + main.stats.uploadsBytes) : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(main.stats?.lastLoginAt)}</td>
              </tr>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Hali boshqa markaz yo'q. <Link href="/dev/centers/new" className="font-semibold text-slate-700 underline dark:text-slate-200">Birinchisini yarating</Link>.</td></tr>
              )}
              {rows.map(({ c, up, stats }) => (
                <tr key={c.slug} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/dev/centers/${c.slug}`} className="font-semibold hover:underline">{c.name}</Link>
                    <div className="text-xs text-slate-500">{c.host} · {c.plan}</div>
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "provisioning" ? <Pill tone="blue">Yaratilmoqda</Pill>
                      : c.status === "failed" ? <Pill tone="red">Xato</Pill>
                      : up ? <Pill tone="green">● Ishlayapti</Pill> : <Pill tone="red">● Javob yo'q</Pill>}
                    {c.lastError && c.status === "active" && <div className="mt-1 text-[11px] text-amber-600">{c.lastError}</div>}
                  </td>
                  <td className="px-4 py-3"><LicensePill until={c.licenseUntil} suspended={c.suspended} /><div className="mt-0.5 text-[11px] text-slate-400">{fmtDate(c.licenseUntil)} gacha</div></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ALL_INSTANCE_MODULES.length - c.disabledModules.length}/{ALL_INSTANCE_MODULES.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{stats?.activeStudents ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{stats?.staff ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{stats ? fmtMoney(stats.paidThisMonth) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{stats ? fmtBytes(stats.dbBytes + stats.uploadsBytes) : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(stats?.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Server yuklamasi" value={srv.load?.split(" ")[0] ?? "—"} hint={`1/5/15 daq: ${srv.load ?? "—"} · ${srv.uptime ?? ""}`} />
        <Stat label="Xotira" value={`${memPct}%`} hint={`${srv.mem_used ?? "?"} / ${srv.mem_total ?? "?"} MB`} tone={memPct > 85 ? "red" : memPct > 70 ? "amber" : "slate"} />
        <Stat label="Disk" value={`${diskPct}%`} hint={`${Math.round(+srv.disk_used / 1024) || "?"} / ${Math.round(+srv.disk_total / 1024) || "?"} GB`} tone={diskPct > 85 ? "red" : diskPct > 70 ? "amber" : "slate"} />
      </div>
    </div>
  );
}
