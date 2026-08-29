import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import DateNav from "./DateNav";
import { SortHeader, ExportButton } from "./TableTools";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

interface Acc {
  buyurtma: number; trial: number; yangi: number; aktiv: number; realBor: number; guruhOquvchi: number;
  buyurtmaKetgan: number; aktivKetgan: number; qarzdor: number; guruh: number; birinchiTolov: number; jamiOquvchi: number;
}
const zero = (): Acc => ({ buyurtma: 0, trial: 0, yangi: 0, aktiv: 0, realBor: 0, guruhOquvchi: 0, buyurtmaKetgan: 0, aktivKetgan: 0, qarzdor: 0, guruh: 0, birinchiTolov: 0, jamiOquvchi: 0 });

type Tr = { uz: string; ru: string; en: string; de?: string };
const COLS: { key: keyof Acc | "jamiAktiv" | "qarzFoiz"; label: Tr; pct?: boolean }[] = [
  { key: "buyurtma", label: { uz: "Buyurtma", ru: "Заявка", en: "Lead", de: "Lead" } },
  { key: "trial", label: { uz: "Birinchi darsga keladiganlar", ru: "Приходящие на первый урок", en: "First-lesson attendees", de: "Teilnehmer der ersten Stunde" } },
  { key: "yangi", label: { uz: "Yangi o'quvchi", ru: "Новые ученики", en: "New students", de: "Neue Schüler" } },
  { key: "aktiv", label: { uz: "Aktiv o'quvchilar", ru: "Активные ученики", en: "Active students", de: "Aktive Schüler" } },
  { key: "realBor", label: { uz: "Jami real bor", ru: "Всего реально есть", en: "Total actually present", de: "Insgesamt real anwesend" } },
  { key: "guruhOquvchi", label: { uz: "Guruh o'quvchilari", ru: "Ученики групп", en: "Group students", de: "Schüler in Gruppen" } },
  { key: "buyurtmaKetgan", label: { uz: "Buyurtmadan ketganlar", ru: "Ушедшие из заявки", en: "Left from lead", de: "Vom Lead abgesprungen" } },
  { key: "aktivKetgan", label: { uz: "Aktiv o'quvchidan ketganlar", ru: "Ушедшие активные ученики", en: "Left active students", de: "Abgegangene aktive Schüler" } },
  { key: "qarzdor", label: { uz: "Qarzdorlar", ru: "Должники", en: "Debtors", de: "Schuldner" } },
  { key: "guruh", label: { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" } },
  { key: "birinchiTolov", label: { uz: "Birinchi to'lovni qilganlar", ru: "Совершившие первый платёж", en: "Made first payment", de: "Erste Zahlung geleistet" } },
  { key: "jamiOquvchi", label: { uz: "Jami o'quvchi", ru: "Всего учеников", en: "Total students", de: "Schüler insgesamt" } },
  { key: "jamiAktiv", label: { uz: "Jami aktiv", ru: "Всего активных", en: "Total active", de: "Aktiv insgesamt" } },
  { key: "qarzFoiz", label: { uz: "Qarzdorlarning aktivga nisbatan foizi", ru: "Доля должников от активных", en: "Debtors as % of active", de: "Schuldneranteil an Aktiven (%)" }, pct: true },
];

export default async function BranchesStatusPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section.", de: "Sie haben keinen Zugriff auf diesen Bereich." })} />;
  }
  const sp = await searchParams;
  const dateStr = sp.date || iso(new Date());
  const asOf = new Date(dateStr + "T23:59:59");
  const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);

  const [branches, students, leads, groups] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.student.findMany({ select: { branchId: true, eduStatus: true, createdAt: true, _count: { select: { payments: { where: { status: "PAID" } } } } } }),
    prisma.lead.findMany({ select: { branchId: true, stage: true } }),
    prisma.group.findMany({ select: { branchId: true, _count: { select: { students: true } } } }),
  ]);

  const acc = new Map<string, Acc>();
  const key = (b: string | null) => b ?? "none";
  for (const b of branches) acc.set(b.id, zero());
  acc.set("none", zero());
  const get = (b: string | null) => acc.get(key(b)) ?? acc.get("none")!;

  for (const st of students) {
    const a = get(st.branchId);
    a.jamiOquvchi++;
    const paid = st._count.payments > 0;
    if (paid) a.birinchiTolov++;
    if (st.eduStatus === "ACTIVE") { a.aktiv++; a.realBor++; if (!paid) a.qarzdor++; }
    else if (st.eduStatus === "WAITING") a.trial++;
    else if (["EXPELLED", "TRANSFERRED"].includes(st.eduStatus)) a.aktivKetgan++;
    else if (st.eduStatus === "FROZEN") a.realBor++;
    if (st.createdAt >= monthStart && st.createdAt <= asOf) a.yangi++;
  }
  for (const l of leads) {
    const a = get(l.branchId);
    a.buyurtma++;
    if (l.stage === "LOST") a.buyurtmaKetgan++;
  }
  for (const g of groups) {
    const a = get(g.branchId);
    a.guruh++;
    a.guruhOquvchi += g._count.students;
  }

  const rows = branches.map((b) => ({ id: b.id, name: b.name, ...acc.get(b.id)! }));
  const noneAcc = acc.get("none")!;
  if (noneAcc.jamiOquvchi > 0 || noneAcc.buyurtma > 0 || noneAcc.guruh > 0) rows.push({ id: "none", name: tr(s.locale, { uz: "Filialsiz", ru: "Без филиала", en: "No branch", de: "Ohne Filiale" }), ...noneAcc });

  const totals = zero();
  for (const r of rows) for (const k of Object.keys(totals) as (keyof Acc)[]) totals[k] += r[k];

  const val = (r: Acc, col: (typeof COLS)[number]) => {
    if (col.key === "jamiAktiv") return r.aktiv;
    if (col.key === "qarzFoiz") return r.aktiv > 0 ? Math.round((r.qarzdor / r.aktiv) * 100) : 0;
    return r[col.key as keyof Acc];
  };

  // Saralash (ustun bo'yicha) — URL orqali
  const validSort = new Set<string>(["name", ...COLS.map((c) => String(c.key))]);
  const sortKey = sp.sort && validSort.has(sp.sort) ? sp.sort : "";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  if (sortKey) {
    const col = COLS.find((c) => String(c.key) === sortKey);
    rows.sort((a, b) => {
      let cmp: number;
      if (sortKey === "name" || !col) cmp = a.name.localeCompare(b.name);
      else cmp = val(a, col) - val(b, col);
      return dir === "asc" ? cmp : -cmp;
    });
  }

  // CSV eksporti uchun tayyor qatorlar
  const exportColumns = [{ key: "name", label: tr(s.locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" }) }, ...COLS.map((c) => ({ key: String(c.key), label: tr(s.locale, c.label) }))];
  const exportData: Record<string, string | number>[] = rows.map((r) => {
    const rec: Record<string, string | number> = { name: r.name };
    for (const c of COLS) rec[String(c.key)] = val(r, c) + (c.pct ? "%" : "");
    return rec;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Filiallar holati", ru: "Состояние филиалов", en: "Branches status", de: "Filialstatus" })}</h1>
        <div className="flex items-center gap-2">
          <DateNav date={dateStr} />
          <ExportButton columns={exportColumns} rows={exportData} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1900px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="sticky left-0 z-10 w-12 bg-slate-50 px-4 py-3 dark:bg-slate-800">№</th>
                <th className="sticky left-12 z-10 min-w-[150px] bg-slate-50 px-4 py-3 dark:bg-slate-800">
                  <SortHeader col="name" label={tr(s.locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" })} active={sortKey} dir={dir} locale={s.locale} />
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-3 py-3 text-center">
                    <SortHeader col={String(c.key)} label={tr(s.locale, c.label)} active={sortKey} dir={dir} locale={s.locale} className="justify-center" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr><td colSpan={COLS.length + 2} className="py-16 text-center text-slate-400">{tr(s.locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 text-slate-400 dark:bg-slate-900">{i + 1}</td>
                  <td className="sticky left-12 z-10 bg-white px-4 py-3 font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">{r.name}</td>
                  {COLS.map((c) => {
                    const v = val(r, c);
                    return <td key={c.key} className={`px-3 py-3 text-center tabular-nums ${c.pct ? "font-semibold text-amber-600 dark:text-amber-400" : v ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}>{v}{c.pct ? "%" : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/70 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                <tr>
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 dark:bg-slate-800" />
                  <td className="sticky left-12 z-10 bg-slate-50 px-4 py-3 dark:bg-slate-800">{tr(s.locale, { uz: "Umumiy natija", ru: "Итого", en: "Total", de: "Gesamt" })}</td>
                  {COLS.map((c) => {
                    const v = c.key === "jamiAktiv" ? totals.aktiv : c.key === "qarzFoiz" ? (totals.aktiv > 0 ? Math.round((totals.qarzdor / totals.aktiv) * 100) : 0) : totals[c.key as keyof Acc];
                    return <td key={c.key} className="px-3 py-3 text-center tabular-nums">{v}{c.pct ? "%" : ""}</td>;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
