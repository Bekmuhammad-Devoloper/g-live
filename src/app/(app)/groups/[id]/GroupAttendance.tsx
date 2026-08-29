"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "../../_components/Icon";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { getGroupAttendance, markStudentAttendance, markAllPresent, unlockAttendance, type AttendanceWindowInfo } from "./attendanceActions";

const p2 = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

export function GroupAttendance({ groupId, students, locale }: { groupId: string; students: { id: string; name: string; blocked?: boolean; lessonsThisMonth?: number }[]; locale: Locale }) {
  const [date, setDate] = useState(todayISO());
  const [map, setMap] = useState<Record<string, string>>({});
  const [win, setWin] = useState<AttendanceWindowInfo | null>(null);
  const [loading, startLoad] = useTransition();
  const [, startSave] = useTransition();
  const [unlocking, startUnlock] = useTransition();
  const [blockedNotice, setBlockedNotice] = useState<{ name: string; lessons: number } | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [closedNotice, setClosedNotice] = useState(false);
  const [futureNotice, setFutureNotice] = useState(false);
  // Poyga himoyasi: faqat ENG SO'NGGI so'rov natijasi qo'llanadi
  const reqRef = useRef(0);

  const reload = (forDate: string) => {
    const req = ++reqRef.current;
    startLoad(async () => {
      const r = await getGroupAttendance(groupId, forDate);
      if (req !== reqRef.current) return; // eskirgan javob — tashlab yuboramiz
      if (r.ok) { setMap(r.map ?? {}); setWin(r.window ?? null); }
    });
  };

  useEffect(() => {
    // Sana almashdi — eski oyna/xarita bilan noto'g'ri banner ko'rinmasin
    setWin(null); setMap({}); setClosedNotice(false); setFutureNotice(false); setSkippedCount(0);
    reload(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, date]);

  // win===null → hali yuklanmoqda: belgilash vaqtincha yopiq (server baribir himoyalangan)
  const editable = win ? win.editable : false;

  const notifyDenied = (r: { closed?: boolean; future?: boolean }) => {
    if (r.future) setFutureNotice(true);
    else setClosedNotice(true);
  };

  const mark = (id: string, status: string) => {
    if (!editable) { if (win) notifyDenied({ closed: win.closed, future: win.future }); return; }
    const willClear = map[id] === status;
    const prev = map[id];
    setMap((m) => { const n = { ...m }; if (willClear) delete n[id]; else n[id] = status; return n; }); // optimistik
    startSave(async () => {
      const r = await markStudentAttendance(groupId, date, id, status);
      if (!r.ok) {
        // Server rad etdi (yopiq/kelajak/to'lov/ruxsat) — optimistik o'zgarishni bekor qilamiz
        setMap((m) => { const n = { ...m }; if (prev === undefined) delete n[id]; else n[id] = prev; return n; });
        if (r.blocked) {
          const st = students.find((x) => x.id === id);
          setBlockedNotice({ name: st?.name ?? "", lessons: r.lessonsThisMonth ?? 0 });
        } else notifyDenied(r);
      }
    });
  };
  const allPresent = () => {
    if (!editable) { if (win) notifyDenied({ closed: win.closed, future: win.future }); return; }
    setMap((m) => { const n = { ...m }; for (const s of students) if (!n[s.id] && !s.blocked) n[s.id] = "PRESENT"; return n; });
    startSave(async () => {
      const r = await markAllPresent(groupId, date);
      if (!r.ok) { notifyDenied(r); reload(date); return; } // optimistik belgilarni serverdagi holatga qaytaramiz
      setSkippedCount(r.skippedBlocked ?? 0);
    });
  };
  const doUnlock = () => startUnlock(async () => {
    const r = await unlockAttendance(groupId, date);
    if (r.ok) { setClosedNotice(false); reload(date); }
  });

  const present = students.filter((s) => map[s.id] === "PRESENT" || map[s.id] === "LATE").length;
  const absent = students.filter((s) => map[s.id] === "ABSENT").length;
  const unmarked = students.length - present - absent;

  const isToday = date === todayISO();

  return (
    <div>
      {/* Yopiq oyna banneri — dars + 3 soat o'tgan */}
      {win && win.closed && !win.unlockedUntilLabel && !editable && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4 shrink-0 text-slate-400" />
            {tr(locale, {
              uz: `Davomat yopilgan (${win.closesAtLabel} da muddat tugagan). Belgilanmaganlar avtomatik "yo'q" qilindi. O'zgartirish uchun menejer yoki direktordan ruxsat kerak.`,
              ru: `Посещаемость закрыта (срок истёк ${win.closesAtLabel}). Неотмеченные автоматически «нет». Для изменения нужно разрешение менеджера или директора.`,
              en: `Attendance is closed (window ended ${win.closesAtLabel}). Unmarked were auto-set to absent. Ask a manager or director to unlock.`,
              de: `Die Anwesenheit ist geschlossen (Frist endete um ${win.closesAtLabel}). Unmarkierte wurden automatisch auf „abwesend" gesetzt. Bitten Sie einen Manager oder Direktor um Freischaltung.`,
            })}
          </span>
        </div>
      )}

      {/* Rahbariyat uchun ochish tugmasi (yopiq bo'lsa) */}
      {win && win.closed && win.canUnlock && !win.unlockedUntilLabel && (
        <div className="mb-3">
          <button
            onClick={doUnlock}
            disabled={unlocking}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {unlocking ? <Icon name="refresh" className="h-3.5 w-3.5 animate-spin" /> : <Icon name="check" className="h-3.5 w-3.5" />}
            {tr(locale, { uz: "Davomatni ochish (24 soat)", ru: "Открыть посещаемость (24 ч)", en: "Unlock attendance (24 h)", de: "Anwesenheit freischalten (24 Std.)" })}
          </button>
        </div>
      )}

      {/* Ruxsat bilan ochilgan holat */}
      {win && win.closed && win.unlockedUntilLabel && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <Icon name="clock" className="h-4 w-4 shrink-0" />
          {tr(locale, {
            uz: `Ruxsat bilan ochilgan — ${win.unlockedUntilLabel} gacha tahrirlash mumkin.`,
            ru: `Открыто по разрешению — редактирование до ${win.unlockedUntilLabel}.`,
            en: `Unlocked by permission — editable until ${win.unlockedUntilLabel}.`,
            de: `Per Genehmigung freigeschaltet — bearbeitbar bis ${win.unlockedUntilLabel}.`,
          })}
        </div>
      )}

      {/* Yopiq oynada belgilashga urinish xabari */}
      {closedNotice && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {tr(locale, {
              uz: "Bu kun davomati yopilgan — menejer yoki direktor ruxsat berishi kerak.",
              ru: "Посещаемость этого дня закрыта — нужно разрешение менеджера или директора.",
              en: "This day's attendance is closed — a manager or director must unlock it.",
              de: "Die Anwesenheit dieses Tages ist geschlossen — ein Manager oder Direktor muss sie freischalten.",
            })}
          </span>
          <button onClick={() => setClosedNotice(false)} className="shrink-0 text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* Kelajak sana — oldindan belgilash taqiqlangan */}
      {(futureNotice || (win?.future && !editable)) && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <span className="flex items-center gap-2">
            <Icon name="clock" className="h-4 w-4 shrink-0" />
            {tr(locale, {
              uz: "Kelajak sanaga davomat oldindan belgilanmaydi — dars kuni belgilanadi.",
              ru: "Посещаемость на будущую дату заранее не отмечается — только в день урока.",
              en: "Attendance cannot be pre-marked for a future date — mark it on the lesson day.",
              de: "Die Anwesenheit für ein zukünftiges Datum kann nicht im Voraus markiert werden — nur am Unterrichtstag.",
            })}
          </span>
          {futureNotice && <button onClick={() => setFutureNotice(false)} className="shrink-0 text-amber-400 hover:text-amber-600">✕</button>}
        </div>
      )}

      {/* Bloklangan urinish haqida ogohlantirish */}
      {blockedNotice && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {tr(locale, {
              uz: `${blockedNotice.name} — shu oy ${blockedNotice.lessons} dars o'tildi, to'lov qilinmagan. Avval to'lovni qabul qiling.`,
              ru: `${blockedNotice.name} — в этом месяце проведено ${blockedNotice.lessons} уроков, оплата не произведена. Сначала примите оплату.`,
              en: `${blockedNotice.name} — ${blockedNotice.lessons} lessons this month, unpaid. Accept payment first.`,
              de: `${blockedNotice.name} — ${blockedNotice.lessons} Unterrichtsstunden diesen Monat, unbezahlt. Bitte zuerst die Zahlung erfassen.`,
            })}
          </span>
          <button onClick={() => setBlockedNotice(null)} className="shrink-0 text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {skippedCount > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {tr(locale, {
              uz: `${skippedCount} ta o'quvchi to'lov qilinmagani sabab "Hammasi bor"ga qo'shilmadi.`,
              ru: `${skippedCount} учеников не отмечены из-за неоплаты.`,
              en: `${skippedCount} student(s) skipped due to unpaid mandatory payment.`,
              de: `${skippedCount} Schüler wurden wegen ausstehender Zahlung übersprungen.`,
            })}
          </span>
          <button onClick={() => setSkippedCount(0)} className="shrink-0 text-amber-400 hover:text-amber-600">✕</button>
        </div>
      )}

      {/* Sana + hammasi bor + jamlanma */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="calendar" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        {isToday && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-300">{tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" })}</span>}
        {/* Ochiq oynada yopilish vaqti eslatmasi */}
        {win && !win.closed && isToday && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400" title={tr(locale, { uz: "Dars tugagach 3 soat ichida saqlash mumkin", ru: "Можно сохранить в течение 3 часов после урока", en: "Can be saved within 3 hours after the lesson", de: "Kann innerhalb von 3 Stunden nach dem Unterricht gespeichert werden" })}>
            {tr(locale, { uz: "Yopiladi", ru: "Закроется", en: "Closes", de: "Schließt" })}: {win.closesAtLabel}
          </span>
        )}
        <button
          onClick={allPresent}
          disabled={!editable}
          className={cn(
            "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
            editable
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/40",
          )}
        >
          ✓ {tr(locale, { uz: "Hammasi bor", ru: "Все присутствуют", en: "All present", de: "Alle anwesend" })}
        </button>
        <div className={cn("ml-auto flex items-center gap-2.5 text-xs", loading && "opacity-50")}>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{tr(locale, { uz: "Bor", ru: "Есть", en: "Present", de: "Anwesend" })}: {present}</span>
          <span className="font-semibold text-rose-500">{tr(locale, { uz: "Yo'q", ru: "Нет", en: "Absent", de: "Abwesend" })}: {absent}</span>
          <span className="text-slate-400">{tr(locale, { uz: "Belgilanmagan", ru: "Не отмечено", en: "Unmarked", de: "Nicht markiert" })}: {unmarked}</span>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">{tr(locale, { uz: "O'quvchi yo'q", ru: "Нет учеников", en: "No students", de: "Keine Schüler" })}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {students.map((s) => {
            const st = map[s.id];
            const isAttending = st === "PRESENT" || st === "LATE";
            // Bloklangan holat faqat hali "keldi" deb belgilanmagan bo'lsa amal qiladi (mavjud belgini o'chirish/o'zgartirish erkin)
            const isBlocked = !!s.blocked && !isAttending;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/students/${s.id}`}
                    title={tr(locale, { uz: "O'quvchi ma'lumotlari", ru: "Данные ученика", en: "Student details", de: "Schülerdetails" })}
                    className="min-w-0 truncate text-sm text-slate-700 transition hover:text-brand-600 hover:underline dark:text-slate-200 dark:hover:text-brand-300"
                  >
                    {s.name}
                  </Link>
                  {isBlocked && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400" title={tr(locale, { uz: `Shu oy ${s.lessonsThisMonth} dars o'tildi — to'lov majburiy`, ru: `В этом месяце ${s.lessonsThisMonth} уроков — оплата обязательна`, en: `${s.lessonsThisMonth} lessons this month — payment required`, de: `${s.lessonsThisMonth} Unterrichtsstunden diesen Monat — Zahlung erforderlich` })}>
                      <Icon name="alert" className="h-3 w-3" /> {tr(locale, { uz: "To'lov kerak", ru: "Нужна оплата", en: "Payment needed", de: "Zahlung erforderlich" })}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => mark(s.id, "PRESENT")}
                    disabled={!editable}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold transition",
                      !editable && st !== "PRESENT" ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-700" :
                      st === "PRESENT" ? "border-emerald-500 bg-emerald-500 text-white" : isBlocked ? "border-rose-200 text-rose-300 hover:border-rose-400 hover:text-rose-500 dark:border-rose-900/40" : "border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-700",
                      !editable && "cursor-not-allowed")}
                    title={!editable ? tr(locale, { uz: "Davomat yopilgan", ru: "Посещаемость закрыта", en: "Attendance closed", de: "Anwesenheit geschlossen" }) : isBlocked ? tr(locale, { uz: "To'lov majburiy — avval to'lovni qabul qiling", ru: "Оплата обязательна — сначала примите оплату", en: "Payment required first", de: "Zahlung zuerst erforderlich" }) : tr(locale, { uz: "Bor (keldi)", ru: "Присутствует", en: "Present", de: "Anwesend (da)" })}
                  >✓</button>
                  <button
                    onClick={() => mark(s.id, "ABSENT")}
                    disabled={!editable}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold transition",
                      st === "ABSENT" ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-500 dark:border-slate-700",
                      !editable && "cursor-not-allowed opacity-70")}
                    title={!editable ? tr(locale, { uz: "Davomat yopilgan", ru: "Посещаемость закрыта", en: "Attendance closed", de: "Anwesenheit geschlossen" }) : tr(locale, { uz: "Yo'q (kelmadi)", ru: "Отсутствует", en: "Absent", de: "Abwesend (nicht da)" })}
                  >✕</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
