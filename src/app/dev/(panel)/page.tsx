import Link from "next/link";
import path from "node:path";
import { readRegistry, centerDb, centerDir, APP_DIR, BASE_DOMAIN } from "@/lib/devpanel/registry";
import { centerStats, health, sysInfo, mainLicense, type CenterStats, type SysInfo } from "@/lib/devpanel/ops";
import { ALL_INSTANCE_MODULES } from "@/lib/instance";
import { Card, Stat, Pill, LicensePill, Bar, IconChip, fmtBytes, fmtMoney, fmtDate, fmtDateTime, daysLeft } from "./ui";
import { UpdateAllButton } from "./DashboardControls";

export const dynamic = "force-dynamic";

type Alert = { tone: "red" | "amber"; text: string; href?: string };

const certDays = (s: SysInfo, host: string): number | null => {
  const c = s.certs.find((x) => x.domains.includes(host) || x.name === host);
  return c?.expires ? Math.floor((new Date(c.expires).getTime() - Date.now()) / 86_400_000) : null;
};

export default async function DevDashboard() {
  const reg = await readRegistry();
  const centers = reg.centers.filter((c) => c.status !== "deleted");
  const [rows, main, sys, mainUntil] = await Promise.all([
    Promise.all(centers.map(async (c) => ({
      c,
      up: await health(c.port, 2500),
      stats: await centerStats(centerDb(c.slug), path.join(centerDir(c.slug), "uploads")),
    }))),
    (async () => ({ up: await health(3000, 2500), stats: await centerStats(path.join(APP_DIR, "prisma", "dev.db"), path.join(APP_DIR, "public", "uploads")) }))(),
    sysInfo(),
    mainLicense(),
  ]);

  const all: (CenterStats | null)[] = [main.stats, ...rows.map((r) => r.stats)];
  const sum = (k: keyof CenterStats) => all.reduce((n, s) => n + (Number(s?.[k]) || 0), 0);
  const paidNow = sum("paidThisMonth"), paidPrev = sum("paidLastMonth");
  const growth = paidPrev > 0 ? Math.round(((paidNow - paidPrev) / paidPrev) * 100) : null;
  const memTotal = +sys.kv.mem_total || 0, memUsed = memTotal - (+sys.kv.mem_available || 0);
  const root = sys.disks.find((d) => d.mount === "/");
  const diskPct = root ? (root.used / root.size) * 100 : 0;
  const svc = (name: string) => sys.services.find((v) => v.name === name);

  const alerts: Alert[] = [];
  if (!main.up) alerts.push({ tone: "red", text: "Germaniya Live (asosiy sayt) javob bermayapti", href: "/dev/main" });
  for (const v of sys.services) if (v.active !== "active" && !v.name.startsWith("gl-center@")) alerts.push({ tone: "red", text: `Xizmat ishlamayapti: ${v.name} (${v.active})`, href: "/dev/server" });
  if (diskPct > 85) alerts.push({ tone: "red", text: `Disk ${Math.round(diskPct)}% to'lgan`, href: "/dev/server" });
  else if (diskPct > 70) alerts.push({ tone: "amber", text: `Disk ${Math.round(diskPct)}% band — joy tugashiga e'tibor bering`, href: "/dev/server" });
  if (memTotal && memUsed / memTotal > 0.85) alerts.push({ tone: "red", text: `Xotira ${Math.round((memUsed / memTotal) * 100)}% band`, href: "/dev/server" });
  for (const c of sys.certs) {
    const d = c.expires ? Math.floor((new Date(c.expires).getTime() - Date.now()) / 86_400_000) : null;
    if (d !== null && d <= 14) alerts.push({ tone: d < 0 ? "red" : "amber", text: `SSL ${c.name}: ${d < 0 ? "muddati o'tgan" : `${d} kun qoldi`}`, href: "/dev/server" });
  }
  if (sys.backupTimer.last && Date.now() - new Date(sys.backupTimer.last).getTime() > 36 * 3600_000 && centers.length > 0) alerts.push({ tone: "amber", text: `Markazlar zaxirasi 36 soatdan beri olinmagan (oxirgi: ${fmtDateTime(sys.backupTimer.last)})`, href: "/dev/server" });
  const md = daysLeft(mainUntil);
  if (md !== null && md <= 14) alerts.push({ tone: md < 0 ? "red" : "amber", text: `Germaniya Live litsenziyasi: ${md < 0 ? "muddati o'tgan" : `${md} kun qoldi`}`, href: "/dev/main" });
  for (const { c, up } of rows) {
    const d = daysLeft(c.licenseUntil);
    if (c.status === "failed") alerts.push({ tone: "red", text: `${c.name}: yaratishda xato — ${c.lastError ?? ""}`, href: `/dev/centers/${c.slug}` });
    else if (!up && !c.suspended) alerts.push({ tone: "red", text: `${c.name}: javob bermayapti`, href: `/dev/centers/${c.slug}` });
    if (c.suspended) alerts.push({ tone: "amber", text: `${c.name}: to'xtatilgan`, href: `/dev/centers/${c.slug}` });
    else if (d !== null && d <= 14) alerts.push({ tone: d < 0 ? "red" : "amber", text: `${c.name}: litsenziya ${d < 0 ? "muddati o'tgan" : `${d} kun qoldi`}`, href: `/dev/centers/${c.slug}` });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">O'quv markazlari</h1>
          <p className="mt-1 text-sm text-slate-400">Yangilangan: {fmtDateTime(new Date().toISOString())} · server {sys.kv.ip}</p>
        </div>
        <div className="flex gap-2">
          <UpdateAllButton />
          <Link href="/dev/centers/new" className="rounded-lg bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 hover:brightness-110">+ Yangi markaz</Link>
        </div>
      </div>

      {alerts.length > 0 ? (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            </span>
            E'tibor talab qiladi <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300">{alerts.length}</span>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link href={a.href ?? "#"} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-white/[0.03]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === "red" ? "bg-red-500" : "bg-amber-400"}`} />
                  <span className={a.tone === "red" ? "text-red-300" : "text-amber-200"}>{a.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 !py-3.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-emerald-300">Hammasi joyida: barcha xizmatlar ishlayapti, muddatlar va zaxiralar tartibda.</span>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="building" label="Markazlar" value={centers.length + 1} hint={`${rows.filter((r) => r.up).length + (main.up ? 1 : 0)} tasi ishlayapti · ${centers.filter((c) => c.suspended).length} to'xtatilgan`} />
        <Stat icon="users" label="Faol o'quvchilar" value={sum("activeStudents").toLocaleString("ru-RU")} hint={`Shu oy yangi: ${sum("newStudentsThisMonth")} · jami ${sum("students")}`} tone="blue" />
        <Stat icon="money" label="Shu oy tushum" value={fmtMoney(paidNow)} hint={growth === null ? `${sum("paymentsThisMonth")} ta to'lov` : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% o'tgan oyga nisbatan · ${sum("paymentsThisMonth")} ta to'lov`} tone="green" />
        <Stat icon="activity" label="Bugun faol" value={sum("loginsToday")} hint={`xodim va o'quvchi kirdi · ${sum("staff")} xodim, ${sum("teachers")} o'qituvchi`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="lead" label="Lidlar (shu oy)" value={sum("leadsThisMonth")} hint={`Jami: ${sum("leads")}`} />
        <Stat icon="layers" label="Faol guruhlar" value={sum("groups")} hint={`${sum("branches")} ta filial`} />
        <Link href="/dev/server" className="block"><Card className="relative h-full transition hover:border-orange-400/30">
          <IconChip icon="cpu" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Server · CPU / xotira</div>
          <div className="mt-1.5 text-2xl font-bold">{sys.kv.cpu_pct ?? 0}% <span className="text-base font-semibold text-slate-400">/ {memTotal ? Math.round((memUsed / memTotal) * 100) : 0}%</span></div>
          <Bar pct={memTotal ? (memUsed / memTotal) * 100 : 0} />
          <div className="mt-2 text-xs text-slate-400">{fmtBytes(memUsed)} / {fmtBytes(memTotal)} · yuklama {sys.kv.load?.split(" ")[0]}</div>
        </Card></Link>
        <Link href="/dev/server" className="block"><Card className="relative h-full transition hover:border-orange-400/30">
          <IconChip icon="disk" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Disk</div>
          <div className="mt-1.5 text-2xl font-bold">{Math.round(diskPct)}%</div>
          <Bar pct={diskPct} />
          <div className="mt-2 text-xs text-slate-400">{root ? `${fmtBytes(root.avail)} bo'sh · jami ${fmtBytes(root.size)}` : "—"}</div>
        </Card></Link>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-white/[0.03] text-left text-xs font-semibold uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Markaz</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3">Litsenziya</th>
                <th className="px-4 py-3">Modullar</th>
                <th className="px-4 py-3 text-right">O'quvchi</th>
                <th className="px-4 py-3 text-right">Xodim</th>
                <th className="px-4 py-3 text-right">Shu oy tushum</th>
                <th className="px-4 py-3 text-right">Hajm</th>
                <th className="px-4 py-3 text-right">Xotira</th>
                <th className="px-4 py-3">SSL</th>
                <th className="px-4 py-3">Oxirgi kirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              <CenterRow
                href="/dev/main" name="Germaniya Live" badge="asosiy" host={BASE_DOMAIN} sub={BASE_DOMAIN}
                up={main.up} license={<LicensePill until={mainUntil} />} modules="Hammasi" stats={main.stats}
                mem={svc("gl-edu")?.memBytes ?? null} ssl={certDays(sys, BASE_DOMAIN)}
              />
              {rows.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">Hali boshqa markaz yo'q. <Link href="/dev/centers/new" className="font-semibold text-orange-300 underline">Birinchisini yarating</Link>.</td></tr>
              )}
              {rows.map(({ c, up, stats }) => (
                <CenterRow
                  key={c.slug} href={`/dev/centers/${c.slug}`} name={c.name} host={c.host} sub={`${c.host} · ${c.plan}`}
                  up={c.status === "provisioning" ? null : up} failed={c.status === "failed"}
                  license={<><LicensePill until={c.licenseUntil} suspended={c.suspended} /><div className="mt-0.5 text-[11px] text-slate-500">{fmtDate(c.licenseUntil)} gacha</div></>}
                  modules={`${ALL_INSTANCE_MODULES.length - c.disabledModules.length}/${ALL_INSTANCE_MODULES.length}`} stats={stats}
                  mem={svc(`gl-center@${c.slug}.service`)?.memBytes ?? null} ssl={certDays(sys, c.host)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CenterRow(p: {
  href: string; name: string; badge?: string; host: string; sub: string; up: boolean | null; failed?: boolean;
  license: React.ReactNode; modules: string; stats: CenterStats | null; mem: number | null; ssl: number | null;
}) {
  const s = p.stats;
  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="px-4 py-3">
        <Link href={p.href} className="font-semibold hover:text-orange-300">{p.name}</Link> {p.badge && <Pill tone="blue">{p.badge}</Pill>}
        <div className="text-xs text-slate-500"><a href={`https://${p.host}`} target="_blank" className="hover:underline">{p.sub}</a></div>
      </td>
      <td className="px-4 py-3">
        {p.failed ? <Pill tone="red">Xato</Pill> : p.up === null ? <Pill tone="blue">Yaratilmoqda</Pill> : p.up ? <Pill tone="green">● Ishlayapti</Pill> : <Pill tone="red">● Javob yo'q</Pill>}
      </td>
      <td className="px-4 py-3">{p.license}</td>
      <td className="px-4 py-3 text-slate-300">{p.modules}</td>
      <td className="px-4 py-3 text-right tabular-nums">{s?.activeStudents ?? "—"}<div className="text-[11px] text-slate-500">{s ? `+${s.newStudentsThisMonth} shu oy` : ""}</div></td>
      <td className="px-4 py-3 text-right tabular-nums">{s?.staff ?? "—"}</td>
      <td className="px-4 py-3 text-right tabular-nums">{s ? fmtMoney(s.paidThisMonth) : "—"}<div className="text-[11px] text-slate-500">{s ? `o'tgan oy ${fmtMoney(s.paidLastMonth)}` : ""}</div></td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-400">{s ? fmtBytes(s.dbBytes + s.uploadsBytes) : "—"}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-400">{p.mem ? fmtBytes(p.mem) : "—"}</td>
      <td className="px-4 py-3">{p.ssl === null ? <Pill tone="slate">yo'q</Pill> : p.ssl <= 14 ? <Pill tone="amber">{p.ssl} kun</Pill> : <Pill tone="green">{p.ssl} kun</Pill>}</td>
      <td className="px-4 py-3 text-slate-400">{fmtDate(s?.lastLoginAt)}<div className="text-[11px] text-slate-500">{s ? `bugun ${s.loginsToday} kishi` : ""}</div></td>
    </tr>
  );
}
