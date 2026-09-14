"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { EDU_STATUS_LABELS, label, formatMoney, type Locale } from "@/lib/constants";
import type { ReceiptMode } from "@/lib/receiptMode";
import { Icon } from "../../_components/Icon";
import PaymentPanel from "../PaymentPanel";
import { StudentDetailModal, EditModal, type VStudent } from "../StudentsView";

// O'quvchi profili — sarlavha kartasi + ko'rsatkichlar + bo'limlar.
// Uslub /profile (xodim profili) bilan bir xil: gradient sarlavha, avatar,
// statistika plitalari, tab'lar.
//
// To'lov holati (qarz qo'shish, to'lov qabul qilish, so'nggi to'lovlar) —
// ro'yxatdagi tezkor oyna bilan BITTA komponent (PaymentPanel). "Kichik oynada
// ochish" tugmasi esa o'sha tezkor oynaning o'zini shu sahifada ochadi.

/** Qarz hisobi tafsiloti — src/lib/debt.ts natijasi */
export interface DebtInfo {
  accrued: number; paid: number; manual: number; debt: number; credit: number; months: number; since: string | null;
}

export interface SGroup {
  id: string; name: string; course: string; teacher: string | null; room: string | null;
  status: string; weekdays: string | null; startTime: string | null; endTime: string | null;
  joinedAt: string; isActive: boolean;
}
export interface SProfile {
  id: string; fullName: string; phone: string | null; imageUrl: string | null;
  birthDate: string | null; currentLevel: string | null; eduStatus: string;
  branchName: string | null; joined: string; note: string | null;
  paid: number; debt: number; attendancePct: number | null; lessonsCounted: number;
  groups: SGroup[];
  payments: { id: string; amount: number; method: string; status: string; purpose: string | null; createdAt: string }[];
  exams: { id: string; title: string; score: number | null; passScore: number; status: string; takenAt: string }[];
  attendance: { id: string; status: string; group: string; date: string }[];
  parents: { name: string; phone: string | null; relation: string | null }[];
  lead: { id: string; source: string | null; stage: string; manager: string | null } | null;
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "#10b981", WAITING: "#f59e0b", FROZEN: "#0ea5e9", LEFT: "#ef4444", GRADUATED: "#8b5cf6",
};
const ATT_TONE: Record<string, string> = {
  PRESENT: "#10b981", ONLINE: "#0ea5e9", LATE: "#f59e0b", MAKEUP: "#8b5cf6", EXCUSED: "#64748b", ABSENT: "#ef4444",
};
const PAY_TONE: Record<string, string> = {
  PAID: "#10b981", PENDING: "#f59e0b", REFUNDED: "#0ea5e9", CANCELLED: "#94a3b8",
};
const WD = ["", "Du", "Se", "Chor", "Pa", "Ju", "Sha", "Yak"];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const schedule = (g: SGroup) => {
  const days = (g.weekdays ?? "").split(",").map((d) => WD[Number(d.trim())] ?? "").filter(Boolean).join(", ");
  const time = g.startTime && g.endTime ? `${g.startTime}–${g.endTime}` : g.startTime ?? "";
  return [days, time].filter(Boolean).join(" · ");
};

type Tab = "groups" | "payments" | "attendance" | "exams";

export default function StudentProfile({
  profile: st, locale, debtInfo, quick, canManage, canPay, cashierName, receiptMode,
}: {
  profile: SProfile;
  locale: Locale;
  debtInfo: DebtInfo;
  /** Tezkor oyna uchun ro'yxat qatori shakli */
  quick: VStudent;
  canManage: boolean;
  canPay: boolean;
  cashierName: string;
  receiptMode: ReceiptMode;
}) {
  const router = useRouter();
  // Qarzi bor o'quvchi ochilsa — darrov to'lovlar bo'limi (amal talab qiladi)
  const [tab, setTab] = useState<Tab>(debtInfo.debt > 0 && (canManage || canPay) ? "payments" : "groups");
  const [quickOpen, setQuickOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const tone = STATUS_TONE[st.eduStatus] ?? "#64748b";

  return (
    <div className="space-y-5">
      {/* ── Sarlavha ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="h-24 bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div className="-mt-12 shrink-0">
            {st.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={st.imageUrl} alt="" className="h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-md dark:border-slate-900" />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-md dark:border-slate-900">
                <Icon name="graduation" className="h-10 w-10" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <h1 className="truncate text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{st.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: tone, background: `${tone}1a` }}>
                {label(EDU_STATUS_LABELS, st.eduStatus, locale)}
              </span>
              {st.currentLevel && <span className="font-medium text-slate-600 dark:text-slate-300">{st.currentLevel}</span>}
              {st.phone && (
                <a href={`tel:${st.phone}`} className="flex items-center gap-1 font-medium text-slate-600 transition hover:text-brand-600 dark:text-slate-300">
                  <Icon name="phone" className="h-3.5 w-3.5" /> {st.phone}
                </a>
              )}
              {st.branchName && <span>· {st.branchName}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/students" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Icon name="arrow" className="h-4 w-4 rotate-180" /> {L("Ro'yxatga", "К списку", "Back to list", "Zur Liste")}
            </Link>
            {/* Ro'yxatdagi tezkor oyna — shu yerda ham ochiladi */}
            {(canManage || canPay) && (
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Icon name="minimize" className="h-4 w-4" /> {L("Kichik oynada ochish", "Открыть в окне", "Open in quick view", "Im Schnellfenster öffnen")}
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <Icon name="pencil" className="h-4 w-4" /> {L("Tahrirlash", "Редактировать", "Edit", "Bearbeiten")}
              </button>
            )}
            {st.lead && (
              <Link href={`/crm/${st.lead.id}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Icon name="download" className="h-4 w-4" /> {L("Lid kartasi", "Карточка лида", "Lead card", "Lead-Karte")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Ko'rsatkichlar ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon="layers" tone="#6366f1" label={L("Guruhlar", "Группы", "Groups", "Gruppen")} value={String(st.groups.filter((g) => g.isActive).length)} />
        <Tile icon="wallet" tone="#10b981" label={L("To'langan", "Оплачено", "Paid", "Bezahlt")} value={formatMoney(st.paid, locale)} small />
        <Tile
          icon="alert"
          tone={st.debt > 0 ? "#ef4444" : "#94a3b8"}
          label={L("Qarzdorlik", "Задолженность", "Debt", "Schulden")}
          value={formatMoney(st.debt, locale)}
          hint={debtInfo.months ? `${debtInfo.months} ${L("oy", "мес.", "mo", "Mon.")}` : undefined}
          small
          onClick={() => setTab("payments")}
        />
        <Tile
          icon="check"
          tone="#0ea5e9"
          label={L("Davomat", "Посещаемость", "Attendance", "Anwesenheit")}
          value={st.attendancePct === null ? "—" : `${st.attendancePct}%`}
          hint={st.lessonsCounted ? `${st.lessonsCounted} ${L("dars", "занятий", "lessons", "Stunden")}` : undefined}
        />
      </div>

      {/* ── Izoh ── */}
      {st.note && (
        <div className="flex gap-2.5 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              {L("Izoh", "Примечание", "Note", "Notiz")}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{st.note}</p>
          </div>
        </div>
      )}

      {/* ── Ota-onalar ── */}
      {st.parents.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Icon name="users" className="h-4 w-4 text-slate-400" /> {L("Ota-onalar", "Родители", "Parents", "Eltern")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {st.parents.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                {p.relation && <span className="text-xs text-slate-500 dark:text-slate-400">({p.relation})</span>}
                {p.phone && <a href={`tel:${p.phone}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">{p.phone}</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tablar ── */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "groups"} onClick={() => setTab("groups")} icon="layers" n={st.groups.length}>{L("Guruhlar", "Группы", "Groups", "Gruppen")}</TabBtn>
        <TabBtn active={tab === "payments"} onClick={() => setTab("payments")} icon="wallet" n={st.payments.length}>{L("To'lovlar", "Платежи", "Payments", "Zahlungen")}</TabBtn>
        <TabBtn active={tab === "attendance"} onClick={() => setTab("attendance")} icon="check" n={st.attendance.length}>{L("Davomat", "Посещаемость", "Attendance", "Anwesenheit")}</TabBtn>
        <TabBtn active={tab === "exams"} onClick={() => setTab("exams")} icon="award" n={st.exams.length}>{L("Imtihonlar", "Экзамены", "Exams", "Prüfungen")}</TabBtn>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        {tab === "groups" && (
          st.groups.length === 0 ? <Empty text={L("Guruhga biriktirilmagan", "Не привязан к группе", "Not assigned to a group", "Keiner Gruppe zugewiesen")} /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {st.groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{g.name}</span>
                      {!g.isActive && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                          {L("chiqarilgan", "исключён", "removed", "entfernt")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{g.course}</span>
                      {g.teacher && <span className="flex items-center gap-1"><Icon name="user" className="h-3 w-3" />{g.teacher}</span>}
                      {schedule(g) && <span className="flex items-center gap-1"><Icon name="clock" className="h-3 w-3" />{schedule(g)}</span>}
                      {g.room && <span className="flex items-center gap-1"><Icon name="building" className="h-3 w-3" />{g.room}</span>}
                    </div>
                  </div>
                  <Icon name="chevronDown" className="h-4 w-4 shrink-0 -rotate-90 text-slate-300" />
                </Link>
              ))}
            </div>
          )
        )}

        {tab === "payments" && (
          <div>
            {/* Qarz hisobi — qanday chiqqani to'liq ko'rinadi */}
            <DebtBreakdown info={debtInfo} locale={locale} />

            {/* To'lov holati — tezkor oyna bilan bir xil: qarz qo'shish, to'lov qabul qilish, so'nggi to'lovlar */}
            {(canManage || canPay) && (
              <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                <PaymentPanel
                  studentId={st.id}
                  locale={locale}
                  canManage={canManage}
                  canPay={canPay}
                  cashierName={cashierName}
                  receiptMode={receiptMode}
                  defaultPurpose={st.groups[0] ? `${st.groups[0].course} ${L("kurs to'lovi", "оплата курса", "course fee", "Kursgebühr")}` : L("Kurs to'lovi", "Оплата курса", "Course fee", "Kursgebühr")}
                  onChanged={() => router.refresh()}
                />
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-slate-100 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <Icon name="history" className="h-3.5 w-3.5" /> {L("To'lovlar tarixi", "История платежей", "Payment history", "Zahlungsverlauf")}
            </div>
            {st.payments.length === 0 ? <Empty text={L("To'lov yo'q", "Платежей нет", "No payments", "Keine Zahlungen")} /> : (
              <Rows>
                {st.payments.map((p) => (
                  <Row
                    key={p.id}
                    left={<span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatMoney(p.amount, locale)}</span>}
                    sub={[p.method, p.purpose].filter(Boolean).join(" · ")}
                    right={<Chip tone={PAY_TONE[p.status] ?? "#94a3b8"} text={p.status} />}
                    date={fmtDate(p.createdAt)}
                  />
                ))}
              </Rows>
            )}
          </div>
        )}

        {tab === "attendance" && (
          st.attendance.length === 0 ? <Empty text={L("Davomat yozuvi yo'q", "Нет записей посещаемости", "No attendance records", "Keine Anwesenheitseinträge")} /> : (
            <Rows>
              {st.attendance.map((a) => (
                <Row
                  key={a.id}
                  left={<span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.group}</span>}
                  right={<Chip tone={ATT_TONE[a.status] ?? "#94a3b8"} text={a.status} />}
                  date={fmtDate(a.date)}
                />
              ))}
            </Rows>
          )
        )}

        {tab === "exams" && (
          st.exams.length === 0 ? <Empty text={L("Imtihon natijasi yo'q", "Нет результатов экзаменов", "No exam results", "Keine Prüfungsergebnisse")} /> : (
            <Rows>
              {st.exams.map((e) => (
                <Row
                  key={e.id}
                  left={<span className="text-sm font-medium text-slate-700 dark:text-slate-200">{e.title}</span>}
                  sub={e.score !== null ? `${e.score} / ${e.passScore}` : undefined}
                  right={<Chip tone={e.status === "PASSED" ? "#10b981" : e.status === "FAILED" ? "#ef4444" : "#f59e0b"} text={e.status} />}
                  date={fmtDate(e.takenAt)}
                />
              ))}
            </Rows>
          )
        )}
      </div>

      {quickOpen && (
        <StudentDetailModal
          student={quick}
          locale={locale}
          canManage={canManage}
          canPay={canPay}
          cashierName={cashierName}
          receiptMode={receiptMode}
          onClose={() => { setQuickOpen(false); router.refresh(); }}
          onEdit={() => { setQuickOpen(false); setEditOpen(true); }}
        />
      )}
      {editOpen && (
        <EditModal
          student={quick}
          locale={locale}
          onClose={() => setEditOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ─────────── Yordamchi komponentlar ───────────

// Qarz qanday hisoblangani: hisoblangan + qo'lda kiritilgan − to'langan
function DebtBreakdown({ info, locale }: { info: DebtInfo; locale: Locale }) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const has = info.debt > 0;
  const tone = has ? "#ef4444" : "#10b981";
  const rows: { label: string; value: string; sign?: string; muted?: boolean }[] = [
    {
      label: L("Hisob boshlangan", "Начало расчёта", "Billing since", "Abrechnung seit"),
      value: info.since ? `${fmtDate(info.since)} · ${info.months} ${L("oy", "мес.", "mo", "Mon.")}` : "—",
      muted: true,
    },
    { label: L("Hisoblangan to'lov", "Начислено", "Accrued", "Berechnet"), value: formatMoney(info.accrued, locale) },
    { label: L("Qo'lda kiritilgan qarz", "Долг, внесённый вручную", "Manual debt", "Manuell erfasste Schulden"), value: formatMoney(info.manual, locale), sign: "+" },
    { label: L("To'langan", "Оплачено", "Paid", "Bezahlt"), value: formatMoney(info.paid, locale), sign: "−" },
  ];
  return (
    <div className="px-4 py-4">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon name="chart" className="h-3.5 w-3.5" /> {L("Qarz hisobi", "Расчёт долга", "Debt calculation", "Schuldenberechnung")}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
              <span className={cn(r.muted ? "text-slate-400" : "text-slate-600 dark:text-slate-300")}>{r.label}</span>
              <span className={cn("flex items-center gap-1.5 font-semibold tabular-nums", r.muted ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100")}>
                {r.sign && <span className="w-3 text-center text-slate-400">{r.sign}</span>}
                {r.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex min-w-[200px] flex-col justify-center rounded-xl px-4 py-3" style={{ background: `${tone}14` }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone }}>
            {L("Jami qarz", "Итого долг", "Total debt", "Gesamtschulden")}
          </div>
          <div className="mt-0.5 text-2xl font-black tabular-nums" style={{ color: tone }}>
            {has ? formatMoney(info.debt, locale) : L("Yo'q", "Нет", "None", "Keine")}
          </div>
          {info.credit > 0 && (
            <div className="mt-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
              {L("Balansda", "На балансе", "On balance", "Guthaben")}: {formatMoney(info.credit, locale)}
            </div>
          )}
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {L("hisoblangan + qo'lda − to'langan", "начислено + вручную − оплачено", "accrued + manual − paid", "berechnet + manuell − bezahlt")}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, tone, label, value, hint, small, onClick }: { icon: string; tone: string; label: string; value: string; hint?: string; small?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-slate-200/70 bg-white p-4 text-left shadow-card dark:border-slate-800 dark:bg-slate-900",
        onClick && "transition hover:border-brand-300 hover:shadow-soft",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ color: tone, background: `${tone}1a` }}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className={cn("font-bold text-slate-900 dark:text-slate-100", small ? "text-base" : "text-xl")}>{value}</div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{label}{hint ? ` · ${hint}` : ""}</div>
        </div>
      </div>
    </Tag>
  );
}

function TabBtn({ active, onClick, icon, n, children }: { active: boolean; onClick: () => void; icon: string; n: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
        active
          ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
      {children}
      <span className={cn("rounded-full px-1.5 text-[10px] font-bold", active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>{n}</span>
    </button>
  );
}

const Rows = ({ children }: { children: React.ReactNode }) => (
  <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
);

function Row({ left, sub, right, date }: { left: React.ReactNode; sub?: string; right?: React.ReactNode; date: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        {left}
        {sub && <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {right}
        <span className="w-[86px] text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{date}</span>
      </div>
    </div>
  );
}

const Chip = ({ tone, text }: { tone: string; text: string }) => (
  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: tone, background: `${tone}1a` }}>{text}</span>
);

const Empty = ({ text }: { text: string }) => (
  <div className="px-4 py-14 text-center text-sm text-slate-400">{text}</div>
);
