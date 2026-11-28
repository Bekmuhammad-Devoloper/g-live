import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getBrand } from "@/lib/brand";
import { getRoomSchedule, type RoomLesson } from "@/lib/roomSchedule";
import BrandLogo from "@/app/BrandLogo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [brand, room] = await Promise.all([getBrand(), getRoomSchedule(id)]);
  return { title: room ? `${room.name} — ${brand.name}` : brand.name, robots: { index: false, follow: false } };
}

function localeOf(accept: string): Locale {
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase() as Locale;
    if (LOCALES.includes(code)) return code;
  }
  return "uz";
}

function tashkentNow() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { dow: dow > 0 ? dow : 1, min: Number(get("hour")) * 60 + Number(get("minute")), clock: `${get("hour")}:${get("minute")}` };
}

const DAY: Record<Locale, string[]> = {
  uz: ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"],
  ru: ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  en: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  de: ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
};

function dur(min: number, locale: Locale) {
  const h = Math.floor(min / 60), m = min % 60;
  const hs = tr(locale, { uz: "soat", ru: "ч", en: "h", de: "Std." });
  const ms = tr(locale, { uz: "daq", ru: "мин", en: "min", de: "Min." });
  return h ? `${h} ${hs}${m ? ` ${m} ${ms}` : ""}` : `${m} ${ms}`;
}

function LessonRow({ l, state, locale }: { l: RoomLesson; state: "past" | "now" | "next"; locale: Locale }) {
  return (
    <li className={`flex gap-3 rounded-2xl border p-3.5 ${state === "now" ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"} ${state === "past" ? "opacity-55" : ""}`}>
      <div className="w-[68px] shrink-0 text-center">
        <div className="text-[17px] font-extrabold leading-tight text-slate-900 dark:text-slate-100">{l.start}</div>
        <div className="text-xs font-medium text-slate-400">{l.end}</div>
      </div>
      <div className="min-w-0 flex-1 border-l border-slate-200 pl-3 dark:border-slate-700">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-100">{l.group}</div>
          {state === "now" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {tr(locale, { uz: "Hozir", ru: "Сейчас", en: "Now", de: "Jetzt" })}
            </span>
          )}
        </div>
        {l.course && <div className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">{l.course}</div>}
        {l.teacher && (
          <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
            <span className="truncate">{l.teacher}</span>
          </div>
        )}
      </div>
    </li>
  );
}

export default async function RoomPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [room, brand, h] = await Promise.all([getRoomSchedule(id), getBrand(), headers()]);
  if (!room) notFound();
  const locale = localeOf(h.get("accept-language") ?? "");
  const now = tashkentNow();
  const today = room.days[now.dow];
  const current = today.find((l) => l.startMin <= now.min && now.min < l.endMin) ?? null;
  const next = today.find((l) => l.startMin > now.min) ?? null;
  const weekTotal = room.days.reduce((n, d) => n + d.length, 0);
  const order = [1, 2, 3, 4, 5, 6, 7].map((k) => ((now.dow - 1 + k) % 7) + 1).filter((d) => d !== now.dow);

  return (
    <main className="min-h-dvh bg-slate-100 pb-10 dark:bg-slate-950">
      <div className="mx-auto max-w-md px-4 pt-5">
        <div className="flex items-center justify-between">
          <BrandLogo brand={brand} variant="light" className="h-8 w-auto max-w-[170px] object-contain" textClassName="text-lg font-extrabold text-slate-900 dark:text-slate-100" />
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
            {DAY[locale][now.dow]} · {now.clock}
          </span>
        </div>

        <section className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e7490] to-[#0b3c4d] p-5 text-white shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room", de: "Raum" })}</div>
          <h1 className="mt-1 break-words text-[34px] font-extrabold leading-tight">{room.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
            {room.capacity > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1">{room.capacity} {tr(locale, { uz: "o'rin", ru: "мест", en: "seats", de: "Plätze" })}</span>}
            {room.branch && <span className="rounded-full bg-white/15 px-2.5 py-1">{room.branch}</span>}
            <span className="rounded-full bg-white/15 px-2.5 py-1">{weekTotal} {tr(locale, { uz: "dars/hafta", ru: "занятий/нед.", en: "lessons/week", de: "Stunden/Woche" })}</span>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/65">{tr(locale, { uz: "Mas'ul", ru: "Ответственный", en: "Responsible", de: "Verantwortlich" })}</div>
              <div className="truncate text-[15px] font-bold">{room.responsible ?? tr(locale, { uz: "Belgilanmagan", ru: "Не назначен", en: "Not assigned", de: "Nicht festgelegt" })}</div>
            </div>
          </div>
        </section>

        <section className={`mt-4 rounded-3xl p-4 shadow-sm ${current ? "bg-emerald-500 text-white" : "bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100"}`}>
          {current ? (
            <>
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/85">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                {tr(locale, { uz: "Hozir dars ketmoqda", ru: "Сейчас идёт занятие", en: "Class in progress", de: "Unterricht läuft" })}
              </div>
              <div className="mt-1.5 text-lg font-extrabold leading-snug">{current.group}</div>
              <div className="text-sm text-white/90">{[current.teacher, `${current.start}–${current.end}`].filter(Boolean).join(" · ")}</div>
              <div className="mt-1 text-xs font-semibold text-white/80">{tr(locale, { uz: `Tugashiga ${dur(current.endMin - now.min, "uz")}`, ru: `До конца ${dur(current.endMin - now.min, "ru")}`, en: `Ends in ${dur(current.endMin - now.min, "en")}`, de: `Endet in ${dur(current.endMin - now.min, "de")}` })}</div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                {tr(locale, { uz: "Hozir bo'sh", ru: "Сейчас свободно", en: "Free now", de: "Jetzt frei" })}
              </div>
              <div className="mt-1.5 text-[15px] font-semibold">
                {next
                  ? tr(locale, { uz: `Keyingi dars ${next.start} da — ${dur(next.startMin - now.min, "uz")} qoldi`, ru: `Следующее занятие в ${next.start} — через ${dur(next.startMin - now.min, "ru")}`, en: `Next class at ${next.start} — in ${dur(next.startMin - now.min, "en")}`, de: `Nächste Stunde um ${next.start} — in ${dur(next.startMin - now.min, "de")}` })
                  : tr(locale, { uz: "Bugun boshqa dars yo'q", ru: "Сегодня занятий больше нет", en: "No more classes today", de: "Heute keine weiteren Stunden" })}
              </div>
            </>
          )}
        </section>

        <h2 className="mb-2 mt-6 px-1 text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {tr(locale, { uz: "Bugungi darslar", ru: "Занятия сегодня", en: "Today's classes", de: "Heutige Stunden" })} · {today.length}
        </h2>
        {today.length ? (
          <ul className="space-y-2">
            {today.map((l, i) => (
              <LessonRow key={`${l.group}-${i}`} l={l} locale={locale} state={l === current ? "now" : l.endMin <= now.min ? "past" : "next"} />
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {tr(locale, { uz: "Bugun bu xonada dars yo'q", ru: "Сегодня в этом кабинете нет занятий", en: "No classes in this room today", de: "Heute keine Stunden in diesem Raum" })}
          </div>
        )}

        <h2 className="mb-2 mt-6 px-1 text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {tr(locale, { uz: "Haftalik jadval", ru: "Расписание на неделю", en: "Weekly schedule", de: "Wochenplan" })}
        </h2>
        <div className="space-y-2">
          {order.map((d) => {
            const list = room.days[d];
            return (
              <details key={d} className="group rounded-2xl bg-white shadow-sm dark:bg-slate-900">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
                  <span className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{DAY[locale][d]}</span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${list.length ? "bg-[#0e7490]/10 text-[#0e7490] dark:bg-cyan-400/15 dark:text-cyan-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}>{list.length}</span>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </summary>
                <div className="border-t border-slate-100 px-3 pb-3 pt-2 dark:border-slate-800">
                  {list.length ? (
                    <ul className="space-y-2">
                      {list.map((l, i) => <LessonRow key={`${l.group}-${i}`} l={l} locale={locale} state="next" />)}
                    </ul>
                  ) : (
                    <div className="py-3 text-center text-sm text-slate-400">{tr(locale, { uz: "Dars yo'q", ru: "Занятий нет", en: "No classes", de: "Keine Stunden" })}</div>
                  )}
                </div>
              </details>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">{brand.name}</p>
      </div>
    </main>
  );
}
