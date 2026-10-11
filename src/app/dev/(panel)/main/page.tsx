import path from "node:path";
import { APP_DIR, BASE_DOMAIN } from "@/lib/devpanel/registry";
import { centerStats, health, sysInfo, mainLicense, mainBackups } from "@/lib/devpanel/ops";
import { Card, Stat, Pill, LicensePill, fmtBytes, fmtMoney, fmtDate, fmtDateTime, fmtDuration } from "../ui";
import { MainLicenseForm, RestartMainButton } from "../DashboardControls";

export const dynamic = "force-dynamic";

const MAIN_SERVICES: [string, string][] = [
  ["gl-edu", "Sayt (Next.js, port 3000)"],
  ["gl-ami", "Qo'ng'iroqlar kuzatuvchisi (AMI)"],
  ["gl-tunnel", "Telefoniya serveriga tunnel"],
  ["gl-cdr.timer", "Qo'ng'iroq tarixi sinxroni (har 10 daq)"],
];

export default async function MainCenterPage() {
  const [up, stats, sys, until, backups] = await Promise.all([
    health(3000, 2500),
    centerStats(path.join(APP_DIR, "prisma", "dev.db"), path.join(APP_DIR, "public", "uploads")),
    sysInfo(),
    mainLicense(),
    mainBackups(),
  ]);
  const cert = sys.certs.find((c) => c.domains.includes(BASE_DOMAIN));
  const now = Date.now();
  const s = stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Germaniya Live</h1>
            <Pill tone="blue">asosiy markaz</Pill>
            {up ? <Pill tone="green">● Ishlayapti</Pill> : <Pill tone="red">● Javob yo'q</Pill>}
            <LicensePill until={until} />
          </div>
          <a href={`https://${BASE_DOMAIN}`} target="_blank" className="mt-1 inline-block font-mono text-sm text-slate-400 hover:underline">{BASE_DOMAIN}</a>
        </div>
        <RestartMainButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="users" label="Faol o'quvchilar" value={s?.activeStudents ?? "—"} hint={s ? `Jami ${s.students} · shu oy yangi ${s.newStudentsThisMonth}` : undefined} tone="blue" />
        <Stat icon="money" label="Shu oy tushum" value={s ? fmtMoney(s.paidThisMonth) : "—"} hint={s ? `${s.paymentsThisMonth} ta to'lov · o'tgan oy ${fmtMoney(s.paidLastMonth)}` : undefined} tone="green" />
        <Stat icon="building" label="Xodimlar" value={s?.staff ?? "—"} hint={s ? `${s.teachers} o'qituvchi · ${s.branches} filial · ${s.groups} faol guruh` : undefined} />
        <Stat icon="lead" label="Lidlar" value={s?.leadsThisMonth ?? "—"} hint={s ? `shu oy · jami ${s.leads} · bugun ${s.loginsToday} kishi kirdi` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Litsenziya va ma'lumotlar</h2>
          <dl className="grid grid-cols-[160px_1fr] gap-y-2.5 text-sm">
            <dt className="text-slate-400">Litsenziya</dt>
            <dd><LicensePill until={until} /> <span className="ml-1 text-slate-300">{fmtDate(until)} gacha</span><MainLicenseForm current={until} /></dd>
            <dt className="text-slate-400">SSL sertifikat</dt>
            <dd>{cert?.expires ? `${fmtDate(cert.expires)} gacha (${Math.floor((new Date(cert.expires).getTime() - now) / 86_400_000)} kun)` : "—"}</dd>
            <dt className="text-slate-400">Baza hajmi</dt><dd>{s ? fmtBytes(s.dbBytes) : "—"}</dd>
            <dt className="text-slate-400">Yuklangan fayllar</dt><dd>{s ? fmtBytes(s.uploadsBytes) : "—"}</dd>
            <dt className="text-slate-400">Oxirgi kirish</dt><dd>{fmtDateTime(s?.lastLoginAt)}</dd>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Xizmatlar</h2>
          <ul className="space-y-2.5 text-sm">
            {MAIN_SERVICES.map(([name, label]) => {
              const v = sys.services.find((x) => x.name === name);
              return (
                <li key={name} className="flex items-center justify-between gap-3">
                  <span><span className="block">{label}</span><span className="font-mono text-[11px] text-slate-500">{name}{v?.memBytes ? ` · ${fmtBytes(v.memBytes)}` : ""}{v?.since ? ` · ${fmtDuration((now - new Date(v.since).getTime()) / 1000)}` : ""}</span></span>
                  {v?.active === "active" ? <Pill tone="green">● Faol</Pill> : <Pill tone="red">● {v?.active ?? "?"}</Pill>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">Baza zaxira nusxalari</h2>
        <p className="mb-3 text-xs text-slate-500">Server ichida, o'zgarishlardan oldin olingan nusxalar (oxirgi 15 tasi).</p>
        <ul className="divide-y divide-white/[0.06] text-sm">
          {backups.length === 0 && <li className="py-2 text-slate-500">Yo'q</li>}
          {backups.map((b) => (
            <li key={b.name} className="flex justify-between gap-3 py-2">
              <span className="truncate font-mono text-xs">{b.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{fmtBytes(b.bytes)} · {fmtDateTime(b.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
