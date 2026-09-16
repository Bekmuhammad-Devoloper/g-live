import { prisma } from "@/lib/db";
import { tr } from "@/lib/tr";
import { financeReadiness } from "@/lib/finance/readiness";
import { Badge, Card, Forbidden, PageHeader } from "../../../_components/ui";
import { READINESS_LABELS, fin } from "../_i18n";
import { financePage } from "../_shared";

// Go-live / billing tayyorlik: bloker bo'lsa flag yoqilmaydi. Faqat o'qiydi — har ochilganda qayta hisoblanadi.
export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  const { session, can, flags } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_PERIOD_CLOSE") && !can("SALARY_RULE_MANAGE")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const r = await financeReadiness(prisma);
  return (
    <>
      <PageHeader title={fin(L, "readiness")} subtitle={`${r.month} · ${tr(L, { uz: "tekshirildi", ru: "проверено", en: "checked", de: "geprüft" })}: ${new Date(r.checkedAt).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })} · Finance V2: ${flags.enabled ? fin(L, "enabled") : fin(L, "disabledShort")}`} />
      <Card className={r.ready ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-lg font-bold ${r.ready ? "text-emerald-700" : "text-red-700"}`}>{r.ready ? fin(L, "readinessReady") : fin(L, "readinessNotReady")}</p>
            <p className="text-xs text-slate-600">{fin(L, "blocker")}: {r.blockers} · {fin(L, "warning")}: {r.warnings} · {tr(L, { uz: "faol o'quvchi", ru: "активных учеников", en: "active students", de: "aktive Schüler" })}: {r.stats.activeStudents} · {tr(L, { uz: "faol guruh", ru: "активных групп", en: "active groups", de: "aktive Gruppen" })}: {r.stats.activeGroups} · {tr(L, { uz: "o'qituvchi", ru: "преподавателей", en: "teachers", de: "Lehrer" })}: {r.stats.teachers}</p>
          </div>
          {!r.ready && <p className="text-xs text-red-700">{tr(L, { uz: "Blokerlar yopilmaguncha Finance V2 yoqilmaydi.", ru: "Пока есть блокеры, Finance V2 не включится.", en: "Finance V2 cannot be enabled while blockers remain.", de: "Finance V2 kann mit Blockern nicht aktiviert werden." })}</p>}
        </div>
      </Card>
      <div className="mt-4 space-y-3">
        {r.issues.length === 0 && <Card><p className="text-sm text-slate-500">{tr(L, { uz: "Hech qanday muammo topilmadi.", ru: "Проблем не найдено.", en: "No issues found.", de: "Keine Probleme gefunden." })}</p></Card>}
        {r.issues.map((i) => (
          <Card key={i.code}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={i.severity === "BLOCKER" ? "red" : i.severity === "WARNING" ? "amber" : "slate"}>{i.severity === "BLOCKER" ? fin(L, "blocker") : fin(L, "warning")}</Badge>
              <h3 className="text-sm font-semibold">{tr(L, READINESS_LABELS[i.code] ?? { uz: i.code, ru: i.code, en: i.code, de: i.code })} <span className="text-slate-400">({i.count})</span></h3>
            </div>
            {i.note && <p className="mb-2 text-xs text-slate-500">{i.note}</p>}
            <ul className="grid gap-1 text-sm md:grid-cols-2">
              {i.items.map((it) => (
                <li key={`${i.code}:${it.id}`} className="flex flex-wrap items-center gap-2">
                  {it.href ? <a className="font-medium text-brand-700 hover:underline" href={it.href}>{it.label}</a> : <span className="font-medium">{it.label}</span>}
                  {it.extra && <span className="text-xs text-slate-500">{it.extra}</span>}
                </li>
              ))}
              {i.count > i.items.length && <li className="text-xs text-slate-400">… +{i.count - i.items.length}</li>}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
