import { redirect } from "next/navigation";
import HeaderBadges from "../HeaderBadges";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeDebt } from "@/lib/debt";
import { EDU_STATUS_LABELS, PAYMENT_METHOD_LABELS, label } from "@/lib/constants";
import { logout } from "../../(app)/actions";
import {
  CARD, NAVY, fmtDate, fmtSum, isAttended,
  PageHeader, FlagAvatar, SectionTitle, Pill,
  IcoWallet, IcoTrophy, IcoDoc, IcoLogout, IcoCalendar,
} from "../_ui";
import MissingStudent from "../MissingStudent";
import PasswordForm from "./PasswordForm";

// "Profil" — o'quvchining shaxsiy sahifasi (Start ekrani uslubida):
// ma'lumotlar, to'lovlar (qarz computeDebt dan), davomat, imtihonlar,
// sertifikatlar, parol almashtirish va chiqish.

const ATT_PILL: Record<string, { tone: "ok" | "warn" | "bad" | "muted"; de: string }> = {
  PRESENT: { tone: "ok", de: "Da" },
  LATE: { tone: "warn", de: "Spät" },
  ONLINE: { tone: "ok", de: "Online" },
  MAKEUP: { tone: "muted", de: "Nachhol" },
  EXCUSED: { tone: "muted", de: "Entschuldigt" },
  ABSENT: { tone: "bad", de: "Fehlt" },
};

export default async function StudentProfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true, fullName: true, phone: true, imageUrl: true, currentLevel: true, eduStatus: true, createdAt: true,
      user: { select: { email: true, imageUrl: true } },
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { joinedAt: true, group: { select: { name: true, levelCode: true } } },
      },
    },
  });
  if (!student) return <MissingStudent />; // redirect("/dashboard") aylanish hosil qilardi

  const [debt, paidAgg, payments, attendance, attAll, exams, examTotal, examPassed, certificates] = await Promise.all([
    computeDebt(student.id),
    prisma.payment.aggregate({ where: { studentId: student.id, status: "PAID" }, _sum: { amount: true } }),
    prisma.payment.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, amount: true, method: true, status: true, purpose: true, createdAt: true },
    }),
    prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { markedAt: "desc" },
      take: 10,
      select: { id: true, status: true, lesson: { select: { startsAt: true, topic: true } } },
    }),
    prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { markedAt: "desc" },
      take: 200,
      select: { status: true },
    }),
    prisma.examResult.findMany({
      where: { studentId: student.id },
      orderBy: { takenAt: "desc" },
      take: 8,
      select: { id: true, score: true, status: true, takenAt: true, exam: { select: { title: true, passScore: true } } },
    }),
    // Ko'rsatkich JAMI natija bo'lishi kerak — ro'yxatdagi oxirgi 8 tadan emas
    prisma.examResult.count({ where: { studentId: student.id } }),
    prisma.examResult.count({ where: { studentId: student.id, status: "PASSED" } }),
    prisma.certificate.findMany({
      where: { studentId: student.id, status: "ISSUED" },
      orderBy: { issuedAt: "desc" },
      select: { id: true, number: true, programName: true, levelCode: true, qrCode: true, issuedAt: true },
    }),
  ]);

  const group = student.enrollments[0]?.group ?? null;
  const avatarUrl = student.imageUrl || student.user?.imageUrl || null;
  const level = group?.levelCode ?? student.currentLevel ?? "A1";
  const present = attAll.filter((a) => isAttended(a.status)).length; // kanonik formula (Start bilan bir xil)
  const attPct = attAll.length ? Math.round((present / attAll.length) * 100) : 0;
  const totalPaid = paidAgg._sum.amount ?? 0;

  return (
    <div className="space-y-[18px]">
      <PageHeader title="Profil" subtitle="Dein Konto" right={<HeaderBadges />} />

      {/* ── Shaxsiy karta ── */}
      <div className={`${CARD} flex items-center gap-4 p-5`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={student.fullName} className="h-16 w-16 shrink-0 rounded-full object-cover shadow-[0_8px_16px_rgba(14,116,144,0.3)]" />
        ) : (
          <span className="shrink-0 rounded-full shadow-[0_8px_16px_rgba(19,78,94,0.22)]"><FlagAvatar s={64} id="glProfilAvatar" /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-extrabold leading-tight text-slate-900">{student.fullName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="ok">{level}</Pill>
            <Pill tone="muted">{label(EDU_STATUS_LABELS, student.eduStatus, session.locale)}</Pill>
          </div>
          {group && <div className="mt-1.5 truncate text-[12.5px] text-slate-500">{group.name}</div>}
        </div>
      </div>

      {/* ── Yig'ma ko'rsatkichlar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Anwesenheit", value: `${attPct}%` },
          { label: "Prüfungen", value: `${examPassed}/${examTotal}` },
          { label: "Zertifikate", value: String(certificates.length) },
        ].map((t) => (
          <div key={t.label} className={`${CARD} flex flex-col items-center gap-1.5 px-1 pb-4 pt-4`}>
            <span className="whitespace-nowrap text-[20px] font-extrabold leading-none" style={{ color: NAVY }}>{t.value}</span>
            <span className="text-[11.5px] font-medium text-slate-500">{t.label}</span>
          </div>
        ))}
      </div>

      {/* ── To'lovlar ── */}
      <SectionTitle>Zahlungen</SectionTitle>
      <div className={`${CARD} p-5`}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoWallet s={22} /></span>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jami to&apos;langan</div>
            <div className="text-[17px] font-extrabold text-slate-900">{fmtSum(totalPaid)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Qarz</div>
            <div className={`text-[17px] font-extrabold ${debt.debt > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {debt.debt > 0 ? fmtSum(debt.debt) : "0 so'm"}
            </div>
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800">
                    {p.purpose || label(PAYMENT_METHOD_LABELS, p.method, session.locale)}
                  </div>
                  <div className="text-[11.5px] text-slate-400">
                    {fmtDate(p.createdAt)} · {label(PAYMENT_METHOD_LABELS, p.method, session.locale)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="whitespace-nowrap text-[14px] font-extrabold text-slate-900">{fmtSum(p.amount)}</div>
                  {p.status === "PENDING" ? <Pill tone="bad">Qarz</Pill> : p.status === "PAID" ? <Pill tone="ok">To&apos;landi</Pill> : <Pill tone="muted">{p.status}</Pill>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Davomat ── */}
      {attendance.length > 0 && (
        <>
          <SectionTitle>Anwesenheit</SectionTitle>
          <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
            {attendance.map((a) => {
              const s = ATT_PILL[a.status] ?? { tone: "muted" as const, de: a.status };
              return (
                <div key={a.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoCalendar s={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-slate-800">{a.lesson.topic || "Unterricht"}</div>
                    <div className="text-[11.5px] text-slate-400">{fmtDate(a.lesson.startsAt)}</div>
                  </div>
                  <Pill tone={s.tone}>{s.de}</Pill>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Imtihonlar ── */}
      {exams.length > 0 && (
        <>
          <SectionTitle>Prüfungen</SectionTitle>
          <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
            {exams.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoTrophy s={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800">{e.exam.title}</div>
                  <div className="text-[11.5px] text-slate-400">{fmtDate(e.takenAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {e.score !== null && <span className="text-[14px] font-extrabold" style={{ color: NAVY }}>{e.score}</span>}
                  {e.status === "PASSED" ? <Pill tone="ok">Bestanden</Pill> : e.status === "FAILED" ? <Pill tone="bad">Nicht bestanden</Pill> : <Pill tone="muted">Wartet</Pill>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Sertifikatlar ── */}
      {certificates.length > 0 && (
        <>
          <SectionTitle>Zertifikate</SectionTitle>
          <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
            {certificates.map((c) => (
              <a key={c.id} href={`/verify/${c.qrCode}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoDoc s={19} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800">
                    {c.programName}{c.levelCode ? ` · ${c.levelCode}` : ""}
                  </div>
                  <div className="text-[11.5px] text-slate-400">№ {c.number} · {fmtDate(c.issuedAt)}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
              </a>
            ))}
          </div>
        </>
      )}

      {/* ── Sozlamalar ── */}
      <SectionTitle>Einstellungen</SectionTitle>
      <div className={`${CARD} px-5 py-1`}>
        <PasswordForm />
        <div className="border-t border-slate-100">
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-3 py-3.5 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-50"><IcoLogout s={20} /></span>
              <span className="flex-1 text-[14px] font-semibold text-rose-600">Abmelden</span>
            </button>
          </form>
        </div>
      </div>

      {/* Hisob ma'lumoti */}
      <p className="pb-2 text-center text-[11.5px] text-slate-400">
        {student.user?.email}{student.phone ? ` · ${student.phone}` : ""} · GL {fmtDate(student.createdAt)} dan beri
      </p>
    </div>
  );
}
