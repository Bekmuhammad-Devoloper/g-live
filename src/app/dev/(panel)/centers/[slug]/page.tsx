import Link from "next/link";
import path from "node:path";
import { notFound } from "next/navigation";
import { getCenter, centerDb, centerDir } from "@/lib/devpanel/registry";
import { centerStats, health, glCenter, listBackups } from "@/lib/devpanel/ops";
import { readDevAudit } from "@/lib/devpanel/auth";
import { INSTANCE_MODULES, ALL_INSTANCE_MODULES } from "@/lib/instance";
import { Card, Stat, Pill, LicensePill, fmtBytes, fmtMoney, fmtDate } from "../../ui";
import CenterControls from "./CenterControls";

export const dynamic = "force-dynamic";

export default async function CenterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCenter(slug);
  if (!c || c.status === "deleted") notFound();

  const [up, stats, svc, logs, backups, audit] = await Promise.all([
    health(c.port, 2500),
    centerStats(centerDb(slug), path.join(centerDir(slug), "uploads")),
    glCenter("status", slug),
    glCenter("logs", slug, "80"),
    listBackups(slug),
    readDevAudit(500),
  ]);
  const history = audit.filter((a) => a.slug === slug).slice(0, 30);
  const modules = ALL_INSTANCE_MODULES.map((k) => ({ key: k, name: INSTANCE_MODULES[k].uz, desc: INSTANCE_MODULES[k].desc, on: !c.disabledModules.includes(k) }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dev" className="text-sm text-slate-500 hover:underline">← Markazlar</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{c.name}</h1>
          {up ? <Pill tone="green">● Ishlayapti</Pill> : <Pill tone="red">● Javob yo'q ({svc.out || "?"})</Pill>}
          <LicensePill until={c.licenseUntil} suspended={c.suspended} />
          {c.status === "failed" && <Pill tone="red">Yaratishda xato</Pill>}
        </div>
        <div className="mt-1 text-sm text-slate-500">
          <a href={`https://${c.host}`} target="_blank" className="font-mono hover:underline">{c.host}</a> · port {c.port} · {c.plan} · yaratilgan {fmtDate(c.createdAt)}
        </div>
        {c.lastError && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{c.lastError}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Faol o'quvchilar" value={stats?.activeStudents ?? "—"} hint={`Jami: ${stats?.students ?? "—"} · Lidlar: ${stats?.leads ?? "—"}`} tone="blue" />
        <Stat label="Xodimlar" value={stats?.staff ?? "—"} hint={`Faol guruhlar: ${stats?.groups ?? "—"}`} />
        <Stat label="Shu oy tushum" value={stats ? fmtMoney(stats.paidThisMonth) : "—"} tone="green" />
        <Stat label="Hajm" value={stats ? fmtBytes(stats.dbBytes + stats.uploadsBytes) : "—"} hint={stats ? `Baza ${fmtBytes(stats.dbBytes)} · fayllar ${fmtBytes(stats.uploadsBytes)} · oxirgi kirish ${fmtDate(stats.lastLoginAt)}` : undefined} />
      </div>

      <CenterControls
        center={{ slug: c.slug, name: c.name, plan: c.plan, licenseUntil: c.licenseUntil, suspended: c.suspended, contactName: c.contactName, contactPhone: c.contactPhone, notes: c.notes, directorEmail: c.directorEmail, host: c.host }}
        modules={modules}
        backups={backups}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Amallar tarixi</h2>
          {history.length === 0 ? <p className="text-sm text-slate-400">Hali yozuv yo'q</p> : (
            <ul className="space-y-1.5 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{h.action}</span>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDate(h.at)} {h.at?.slice(11, 16)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Xizmat jurnali (oxirgi 80 qator)</h2>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">{logs.out || "—"}</pre>
        </Card>
      </div>
    </div>
  );
}
