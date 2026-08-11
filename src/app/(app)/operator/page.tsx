import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { Forbidden } from "../_components/ui";
import { Icon } from "../_components/Icon";

// ─── Operator konsoli (individual operator dashboard) ───
// Imkon Operator rolidan moslashtirilgan — o'z lid/qo'ng'iroq/KPI statistikasi.

type Period = "today" | "week" | "month" | "year";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" }, { key: "week", label: "Hafta" },
  { key: "month", label: "Oy" }, { key: "year", label: "Yil" },
];
const DOW = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${p2(Math.round(sec % 60))}`;
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
function hue(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h; }

export default async function OperatorConsolePage({ searchParams }: { searchParams: Promise<{ period?: string; op?: string }> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS) && !canRead(s.role, MODULES.CRM)) {
    return <Forbidden title="Kirish taqiqlangan" body="Bu bo'lim savdo bo'limi uchun." />;
  }
  const locale = s.locale as Locale;
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.key === sp.period)?.key ?? "today") as Period;
  const isHead = canRead(s.role, MODULES.REPORTS);
  const opId = isHead && sp.op ? sp.op : s.userId;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from =
    period === "week" ? new Date(todayStart.getTime() - 6 * 86400000)
    : period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === "year" ? new Date(now.getFullYear(), 0, 1)
    : todayStart;

  const [op, calls, leads, reminders] = await Promise.all([
    prisma.user.findUnique({ where: { id: opId }, select: { fullName: true } }),
    prisma.call.findMany({ where: { operatorId: opId }, select: { direction: true, status: true, duration: true, startedAt: true } }),
    prisma.lead.findMany({ where: { managerId: opId }, orderBy: { createdAt: "desc" }, select: { id: true, stage: true, fullName: true, phone: true, source: true, createdAt: true } }),
    prisma.task.findMany({ where: { kind: "REMINDER", assigneeId: opId, status: "OPEN" }, orderBy: { dueAt: "asc" }, take: 6, select: { id: true, title: true, dueAt: true } }),
  ]);

  // ── Qo'ng'iroq statistikasi (davr) ──
  const cp = calls.filter((c) => c.startedAt >= from);
  const incoming = cp.filter((c) => c.direction === "INCOMING").length;
  const outgoing = cp.filter((c) => c.direction === "OUTGOING").length;
  const answered = cp.filter((c) => c.status === "ANSWERED").length;
  const missed = cp.filter((c) => c.status === "MISSED" || c.status === "NO_ANSWER").length;
  const talkSec = cp.reduce((n, c) => n + c.duration, 0);
  const totalCalls = cp.length;
  const answeredPct = totalCalls ? Math.round((answered / totalCalls) * 100) : 0;
  const avgDur = answered ? Math.round(talkSec / answered) : 0;

  // ── Lid statistikasi ──
  const assigned = leads.length;
  const newCount = leads.filter((l) => l.stage === "NEW").length;
  const won = leads.filter((l) => l.stage === "WON").length;
  const lost = leads.filter((l) => l.stage === "LOST").length;
  const reprocess = leads.filter((l) => l.stage === "IN_PROGRESS" || l.stage === "CONTACTED").length;
  const worked = leads.filter((l) => l.stage !== "NEW").length;
  const conv = assigned ? Math.round((won / assigned) * 100) : 0;

  // ── Qo'ng'iroq tahlili (breakdown) ──
  const breakdown: [string, number][] = [["Javob berilgan", answered], ["O'tkazib yuborilgan", missed], ["Kiruvchi", incoming], ["Chiquvchi", outgoing]];
  const maxB = Math.max(1, ...breakdown.map(([, v]) => v));

  // ── Haftalik faoliyat (so'nggi 7 kun) ──
  const days: { label: string; calls: number; won: number; worked: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86400000);
    const dEnd = new Date(d.getTime() + 86400000);
    days.push({
      label: DOW[d.getDay()],
      calls: calls.filter((c) => c.startedAt >= d && c.startedAt < dEnd).length,
      won: leads.filter((l) => l.stage === "WON" && l.createdAt >= d && l.createdAt < dEnd).length,
      worked: leads.filter((l) => l.createdAt >= d && l.createdAt < dEnd).length,
    });
  }
  const maxDay = Math.max(1, ...days.map((d) => Math.max(d.calls, d.won, d.worked)));

  const recentLeads = leads.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white"><Icon name="headphones" className="h-6 w-6" /></div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">Operator Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{op?.fullName ?? "Operator"} · kunlik statistika va ko&apos;rsatkichlar</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-1 dark:border-slate-700 dark:bg-slate-800/40">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/operator?period=${p.key}${isHead && sp.op ? `&op=${sp.op}` : ""}`}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${period === p.key ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>{p.label}</Link>
          ))}
        </div>
      </div>

      {/* Qo'ng'iroq tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon="arrowDownLeft" tone="brand" value={incoming} label="Kiruvchi qo'ng'iroqlar" />
        <Tile icon="arrowUpRight" tone="violet" value={outgoing} label="Chiquvchi qo'ng'iroqlar" />
        <Tile icon="check" tone="green" value={answered} label="Javob berilgan" />
        <Tile icon="clock" tone="amber" value={`${Math.round(talkSec / 60)} daq`} label="Gaplashilgan vaqt" />
      </div>

      {/* Tahlil + Ko'rsatkichlar */}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
        <Panel icon="chart" title="Qo'ng'iroqlar tahlili">
          {totalCalls === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">Ma&apos;lumot yo&apos;q</div>
          ) : (
            <div className="space-y-3 pt-1">
              {breakdown.map(([lbl, v]) => (
                <div key={lbl}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600 dark:text-slate-300">{lbl}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{v}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / maxB) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel icon="chart" title="Ko'rsatkichlar">
          <div className="space-y-4 pt-1">
            <Metric label="Javob berilgan" pct={answeredPct} tone="emerald" />
            <Metric label="Konversiya (KPI)" pct={conv} tone="brand" />
            <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Mini value={totalCalls} label="Jami qo'ng'iroq" />
              <Mini value={missed} label="O'tkazib yuborilgan" />
              <Mini value={mmss(avgDur)} label="O'rtacha davomiylik" />
              <Mini value={assigned} label="Boshlangan lidlar" />
            </div>
          </div>
        </Panel>
      </div>

      {/* Lid tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon="download" tone="brand" value={assigned} label="Tayinlangan lidlar" delta={`${newCount} yangi`} />
        <Tile icon="check" tone="green" value={won} label="Muvaffaqiyatli" delta={`${conv}%`} />
        <Tile icon="phoneMissed" tone="amber" value={missed} label="Javob yo'q" delta={`${reprocess} qayta`} />
        <Tile icon="eye" tone="violet" value={worked} label="Ishlangan lidlar" delta={`${lost} bloklangan`} />
      </div>

      {/* Haftalik faoliyat */}
      <Panel icon="chart" title="Haftalik faoliyat" legend={[["Ishlangan", "bg-brand-500"], ["Muvaffaqiyatli", "bg-emerald-500"], ["Qo'ng'iroqlar", "bg-amber-500"]]}>
        <div className="flex h-52 items-end gap-2 pt-2">
          {days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-44 w-full items-end justify-center gap-0.5">
                <Bar v={d.worked} max={maxDay} cls="bg-brand-500" />
                <Bar v={d.won} max={maxDay} cls="bg-emerald-500" />
                <Bar v={d.calls} max={maxDay} cls="bg-amber-500" />
              </div>
              <span className="text-[11px] text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Eslatmalar + So'nggi lidlar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="bell" className="h-5 w-5 text-amber-500" /> Eslatmalar</h2>
            <Link href="/reminders" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">Barchasi</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reminders.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">Eslatmalar yo&apos;q</div>
            ) : reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                <Icon name="bell" className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{r.title}</span>
                {r.dueAt && <span className="text-xs text-slate-400">{fmtDate(r.dueAt)}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="users" className="h-5 w-5 text-brand-500" /> So&apos;nggi lidlar</h2>
            <Link href="/crm" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">Barchasi</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLeads.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">Hozircha lidlar yo&apos;q</div>
            ) : recentLeads.map((l) => (
              <Link key={l.id} href={`/crm/${l.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: `hsl(${hue(l.fullName)} 60% 55%)` }}>{initials(l.fullName)}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{l.fullName}</div><div className="truncate text-xs text-slate-400">{l.phone}</div></div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{label(LEAD_STAGE_LABELS, l.stage, locale)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const iconTone: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};

function Tile({ icon, tone, value, label, delta }: { icon: string; tone: string; value: string | number; label: string; delta?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconTone[tone] ?? iconTone.brand}`}><Icon name={icon} className="h-5 w-5" /></div>
        {delta && <span className="text-xs font-semibold text-slate-400">{delta}</span>}
      </div>
      <div className="mt-3 text-[30px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function Panel({ icon, title, legend, children }: { icon: string; title: string; legend?: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name={icon} className="h-5 w-5 text-brand-500" /> {title}</h2>
        {legend && <div className="flex flex-wrap gap-3">{legend.map(([l, c]) => <span key={l} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2.5 w-2.5 rounded-full ${c}`} /> {l}</span>)}</div>}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{label}</span><span className={`font-bold ${tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-brand-600 dark:text-brand-300"}`}>{pct}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${tone === "emerald" ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}

function Mini({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-lg bg-slate-50/70 px-3 py-2 dark:bg-slate-800/40"><div className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</div><div className="text-[11px] text-slate-400">{label}</div></div>;
}

function Bar({ v, max, cls }: { v: number; max: number; cls: string }) {
  return <div className={`w-2 rounded-t ${cls}`} style={{ height: `${Math.max(2, (v / max) * 168)}px` }} title={String(v)} />;
}
