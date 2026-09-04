import Link from "next/link";
import { redirect } from "next/navigation";
import ProfilActions from "./ProfilActions";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { prisma } from "@/lib/db";
import { computeDebt } from "@/lib/debt";
import { EDU_STATUS_LABELS, PAYMENT_METHOD_LABELS, label, type LocaleText } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { logout } from "../../(app)/actions";
import {
  CARD, NAVY, fmtDate, fmtSum, isAttended,
  PageHeader, SectionTitle, Pill,
  IcoWallet, IcoTrophy, IcoDoc, IcoLogout, IcoCalendar,
} from "../_ui";
import { S } from "../_i18n";
import IdCard from "../IdCard";
import MissingStudent from "../MissingStudent";
import PasswordForm from "./PasswordForm";

// "Profil" — o'quvchining shaxsiy sahifasi (Start ekrani uslubida):
// ma'lumotlar, to'lovlar (qarz computeDebt dan), davomat, imtihonlar,
// sertifikatlar, parol almashtirish va chiqish.

const ATT_PILL: Record<string, { tone: "ok" | "warn" | "bad" | "muted"; text: LocaleText }> = {
  PRESENT: { tone: "ok", text: { uz: "Keldi", ru: "Был", en: "Present", de: "Da" } },
  LATE: { tone: "warn", text: { uz: "Kechikdi", ru: "Опоздал", en: "Late", de: "Spät" } },
  ONLINE: { tone: "ok", text: { uz: "Onlayn", ru: "Онлайн", en: "Online", de: "Online" } },
  MAKEUP: { tone: "muted", text: { uz: "Qayta dars", ru: "Отработка", en: "Make-up", de: "Nachhol" } },
  EXCUSED: { tone: "muted", text: { uz: "Sababli", ru: "По причине", en: "Excused", de: "Entschuldigt" } },
  ABSENT: { tone: "bad", text: { uz: "Kelmadi", ru: "Не был", en: "Absent", de: "Fehlt" } },
};

export default async function StudentProfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true, fullName: true, phone: true, phone2: true, imageUrl: true, birthDate: true, age: true,
      currentLevel: true, eduStatus: true, createdAt: true,
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

  const [debt, paidAgg, payments, attendance, attAll, exams, examTotal, examPassed, certificates, noteCount, brainOn] = await Promise.all([
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
    // "Ikkinchi miya" yozuvlari soni — kartochkada ko'rsatiladi
    prisma.note.count({ where: { studentId: student.id } }),
    // Bo'lim menejer tomonidan yoqilganmi (Sozlamalar > O'quvchi portali).
    // O'chiq bo'lsa kartochka ko'rinmaydi — sahifasi ham bloklangan.
    isPortalFeatureOn("gehirn"),
  ]);

  const group = student.enrollments[0]?.group ?? null;
  const avatarUrl = student.imageUrl || student.user?.imageUrl || null;
  const level = group?.levelCode ?? student.currentLevel ?? "A1";
  const present = attAll.filter((a) => isAttended(a.status)).length; // kanonik formula (Start bilan bir xil)
  const attPct = attAll.length ? Math.round((present / attAll.length) * 100) : 0;
  const totalPaid = paidAgg._sum.amount ?? 0;

  return (
    <div className="space-y-[18px]">
      <PageHeader title={t.profile} subtitle={t.yourAccount} backLabel={t.back} right={<ProfilActions t={t} />} />

      {/* ── Guvohnoma ── */}
      <IdCard
        editable={false}
        t={t}
        p={{
          fullName: student.fullName,
          birthDate: student.birthDate ? student.birthDate.toISOString().slice(0, 10) : null,
          age: student.age,
          phone: student.phone,
          phone2: student.phone2,
          imageUrl: avatarUrl,
          level,
          group: group?.name ?? null,
          login: student.user?.email ?? "—",
          studentNo: student.id.slice(-6).toUpperCase(),
          status: label(EDU_STATUS_LABELS, student.eduStatus, session.locale),
        }}
      />

      {/* ── Yig'ma ko'rsatkichlar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t.attendance, value: `${attPct}%` },
          { label: t.exams, value: `${examPassed}/${examTotal}` },
          { label: t.certificates, value: String(certificates.length) },
        ].map((t) => (
          <div key={t.label} className={`${CARD} flex flex-col items-center gap-1.5 px-1 pb-4 pt-4`}>
            <span className="whitespace-nowrap text-[20px] font-extrabold leading-none" style={{ color: NAVY }}>{t.value}</span>
            <span className="text-[11.5px] font-medium text-slate-600">{t.label}</span>
          </div>
        ))}
      </div>

      {/* ── Ikkinchi miya (shaxsiy rivojlanish) — VAQTINCHA O'CHIRILGAN ──
          Talab (2026-09-04): bo'lim to'liq kommentga olindi.
          Qaytarish uchun: shu sarlavha qatorlarini va eng pastdagi yopuvchi
          qatorni olib tashlang, so'ng ichidagi << va >> belgilarini JSX
          komment belgilariga qaytaring.

      << ── Ikkinchi miya (shaxsiy rivojlanish) ──
          Ko'rinishi Sozlamalar > O'quvchi portali dan boshqariladi.
          Hozir o'chirilgan (portal.gehirn = off) — yoqilsa shu yerda chiqadi. >>
      {brainOn && (
      <Link
        href="/student/gehirn"
        className="relative flex items-center gap-3 overflow-hidden rounded-[24px] p-5 text-white shadow-[0_14px_28px_rgba(91,33,182,0.28)]"
        style={{ background: "linear-gradient(120deg, #4c1d95 0%, #7c3aed 55%, #a78bfa 100%)" }}
      >
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4.2a3 3 0 0 0-3 3 2.7 2.7 0 0 0-2 4.4A2.9 2.9 0 0 0 8.6 16 2.8 2.8 0 0 0 12 19.3Z" />
            <path d="M12 4.2a3 3 0 0 1 3 3 2.7 2.7 0 0 1 2 4.4A2.9 2.9 0 0 1 15.4 16 2.8 2.8 0 0 1 12 19.3Z" />
            <path d="M12 4.2v15.1" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[19px] font-extrabold leading-tight">{t.brain}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-white/80">
            {noteCount > 0 ? `${noteCount} ${t.notes}` : t.brainSub}
          </div>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
      )}
      */}

      {/* ── To'lovlar ── */}
      <SectionTitle>{t.payments}</SectionTitle>
      <div className={`${CARD} p-5`}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoWallet s={22} /></span>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Jami to&apos;langan</div>
            <div className="text-[17px] font-extrabold text-slate-900">{fmtSum(totalPaid)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.debt}</div>
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
                  <div className="text-[11.5px] text-slate-500">
                    {fmtDate(p.createdAt)} · {label(PAYMENT_METHOD_LABELS, p.method, session.locale)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="whitespace-nowrap text-[14px] font-extrabold text-slate-900">{fmtSum(p.amount)}</div>
                  {p.status === "PENDING" ? <Pill tone="bad">{t.debt}</Pill> : p.status === "PAID" ? <Pill tone="ok">To&apos;landi</Pill> : <Pill tone="muted">{p.status}</Pill>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Davomat ── */}
      {attendance.length > 0 && (
        <>
          <SectionTitle>{t.attendance}</SectionTitle>
          <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
            {attendance.map((a) => {
              const s = ATT_PILL[a.status] ?? { tone: "muted" as const, de: a.status };
              return (
                <div key={a.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoCalendar s={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-slate-800">{a.lesson.topic || t.lesson}</div>
                    <div className="text-[11.5px] text-slate-500">{fmtDate(a.lesson.startsAt)}</div>
                  </div>
                  <Pill tone={s.tone}>{tr(session.locale, s.text)}</Pill>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Imtihonlar ── */}
      {exams.length > 0 && (
        <>
          <SectionTitle>{t.exams}</SectionTitle>
          <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
            {exams.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoTrophy s={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800">{e.exam.title}</div>
                  <div className="text-[11.5px] text-slate-500">{fmtDate(e.takenAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {e.score !== null && <span className="text-[14px] font-extrabold" style={{ color: NAVY }}>{e.score}</span>}
                  {e.status === "PASSED" ? <Pill tone="ok">{t.passed}</Pill> : e.status === "FAILED" ? <Pill tone="bad">{t.failed}</Pill> : <Pill tone="muted">{t.waiting}</Pill>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Sertifikatlar ── */}
      {certificates.length > 0 && (
        <>
          <SectionTitle>{t.certificates}</SectionTitle>
          <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
            {certificates.map((c) => (
              <a key={c.id} href={`/verify/${c.qrCode}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]"><IcoDoc s={19} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800">
                    {c.programName}{c.levelCode ? ` · ${c.levelCode}` : ""}
                  </div>
                  <div className="text-[11.5px] text-slate-500">№ {c.number} · {fmtDate(c.issuedAt)}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Hisob ma'lumoti */}
      <p className="pb-2 text-center text-[11.5px] text-slate-500">
        {student.user?.email}{student.phone ? ` · ${student.phone}` : ""} · GL {fmtDate(student.createdAt)}
      </p>
    </div>
  );
}
