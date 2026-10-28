import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { branchViaStudent } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import { groupAtDate, monthRange } from "../_components/attribution";
import GroupPaymentsView, { type VGroupRow } from "./GroupPaymentsView";

export default async function PaymentsByGroupsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.PAYMENTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsatingiz yo'q.", ru: "У вас нет доступа к этому разделу.", en: "You do not have permission for this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const sp = await searchParams;
  const { from, to, gte, lte } = monthRange(sp.from, sp.to);

  const rows = await prisma.payment.findMany({
    where: { AND: [{ status: "PAID", createdAt: { gte, lte } }, branchViaStudent(s)] },
    select: {
      amount: true,
      createdAt: true,
      studentId: true,
      student: {
        select: {
          enrollments: {
            select: {
              joinedAt: true,
              leftAt: true,
              group: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  teacher: { select: { fullName: true } },
                  program: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const map = new Map<string, VGroupRow & { payerSet: Set<string> }>();
  let total = 0;
  for (const p of rows) {
    total += p.amount;
    const g = groupAtDate(p.student.enrollments, p.createdAt);
    const key = g?.id ?? "";
    let r = map.get(key);
    if (!r) {
      r = {
        groupId: g?.id ?? null,
        name: g?.name ?? null,
        startDate: g?.startDate?.toISOString() ?? null,
        teacher: g?.teacher?.fullName ?? null,
        courseId: g?.program?.id ?? null,
        course: g?.program?.name ?? null,
        amount: 0,
        payers: 0,
        payerSet: new Set(),
      };
      map.set(key, r);
    }
    r.amount += p.amount;
    r.payerSet.add(p.studentId);
  }

  const groups: VGroupRow[] = [...map.values()]
    .map(({ payerSet, ...r }) => ({ ...r, payers: payerSet.size }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div>
      <LicenseBanner />
      <GroupPaymentsView key={`${from}_${to}`} rows={groups} total={total} from={from} to={to} locale={s.locale} />
    </div>
  );
}
