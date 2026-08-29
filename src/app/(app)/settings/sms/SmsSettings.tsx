"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";

type L = { uz: string; ru: string; en: string; de: string };

interface SmsType {
  key: string;
  label: L;
  counter?: boolean; // +/- sozlagich (masalan necha kun oldin)
  desc: L;
  text: L;
}

const SMS_TYPES: SmsType[] = [
  { key: "prepay", label: { uz: "Oldindan to'lov haqida xabarnoma", ru: "Уведомление о предоплате", en: "Prepayment notification", de: "Benachrichtigung über Vorauszahlung" },
    desc: { uz: "Xabar talabaga to'lov muddati tugashidan 3 kun oldin ertalab soat 9 da yuboriladi.", ru: "Сообщение отправляется ученику за 3 дня до окончания срока оплаты, утром в 9 часов.", en: "The message is sent to the student 3 days before the payment deadline, at 9 a.m.", de: "Die Nachricht wird dem Schüler 3 Tage vor Ablauf der Zahlungsfrist morgens um 9 Uhr gesendet." },
    text: { uz: "Assalomu Alaykum, (STUDENT)! (LC) o'quv markazida o'qish uchun to'lovingiz tez orada tugaydi. Iltimos, oldindan o'qish uchun pul to'lang", ru: "Здравствуйте, (STUDENT)! Срок оплаты за обучение в учебном центре (LC) скоро истекает. Пожалуйста, внесите оплату заранее.", en: "Hello, (STUDENT)! Your tuition payment at (LC) is about to expire. Please pay in advance.", de: "Hallo, (STUDENT)! Ihre Zahlung für den Unterricht im Lernzentrum (LC) läuft bald ab. Bitte zahlen Sie im Voraus." } },
  { key: "low_balance", label: { uz: "Balans yetarli emas", ru: "Недостаточно средств на балансе", en: "Insufficient balance", de: "Unzureichendes Guthaben" }, counter: true,
    desc: { uz: "Talaba balansi belgilangan kunlik chegaradan past bo'lganda yuboriladi. Sonlagichda necha kun oldin ogohlantirish belgilanadi.", ru: "Отправляется, когда баланс ученика ниже установленного дневного порога. Счётчик задаёт, за сколько дней предупреждать.", en: "Sent when the student's balance is below the set daily threshold. The counter sets how many days in advance to warn.", de: "Wird gesendet, wenn das Guthaben des Schülers unter der festgelegten Tagesschwelle liegt. Der Zähler bestimmt, wie viele Tage im Voraus gewarnt wird." },
    text: { uz: "Assalomu Alaykum, (STUDENT)! (LC) markazidagi balansingiz (BALANCE) so'm. Iltimos, hisobingizni to'ldiring.", ru: "Здравствуйте, (STUDENT)! Ваш баланс в центре (LC) — (BALANCE) сум. Пожалуйста, пополните счёт.", en: "Hello, (STUDENT)! Your balance at (LC) is (BALANCE) so'm. Please top up your account.", de: "Hallo, (STUDENT)! Ihr Guthaben im Zentrum (LC) beträgt (BALANCE) so'm. Bitte laden Sie Ihr Konto auf." } },
  { key: "payment_done", label: { uz: "To'lov amalga oshirildi", ru: "Платёж выполнен", en: "Payment completed", de: "Zahlung abgeschlossen" },
    desc: { uz: "Talaba to'lov qilgach darhol yuboriladi.", ru: "Отправляется сразу после оплаты учеником.", en: "Sent immediately after the student makes a payment.", de: "Wird sofort nach der Zahlung des Schülers gesendet." },
    text: { uz: "Assalomu Alaykum, (STUDENT)! (SUM) so'm to'lovingiz qabul qilindi. Rahmat! (LC)", ru: "Здравствуйте, (STUDENT)! Ваш платёж на (SUM) сум принят. Спасибо! (LC)", en: "Hello, (STUDENT)! Your payment of (SUM) so'm has been received. Thank you! (LC)", de: "Hallo, (STUDENT)! Ihre Zahlung von (SUM) so'm wurde erhalten. Danke! (LC)" } },
  { key: "student_added", label: { uz: "Talaba guruhga qo'shildi", ru: "Ученик добавлен в группу", en: "Student added to group", de: "Schüler zur Gruppe hinzugefügt" },
    desc: { uz: "Talaba guruhga biriktirilganda yuboriladi.", ru: "Отправляется, когда ученика прикрепляют к группе.", en: "Sent when the student is assigned to a group.", de: "Wird gesendet, wenn der Schüler einer Gruppe zugewiesen wird." },
    text: { uz: "Assalomu Alaykum, (STUDENT)! Siz (GROUP) guruhiga qo'shildingiz. Dars: (DAYS) (HOURS), (ROOM). (LC)", ru: "Здравствуйте, (STUDENT)! Вы добавлены в группу (GROUP). Занятие: (DAYS) (HOURS), (ROOM). (LC)", en: "Hello, (STUDENT)! You have been added to group (GROUP). Lesson: (DAYS) (HOURS), (ROOM). (LC)", de: "Hallo, (STUDENT)! Sie wurden der Gruppe (GROUP) hinzugefügt. Unterricht: (DAYS) (HOURS), (ROOM). (LC)" } },
  { key: "birthday", label: { uz: "Talaba tug'ilgan kuni", ru: "День рождения ученика", en: "Student's birthday", de: "Geburtstag des Schülers" },
    desc: { uz: "Talabaning tug'ilgan kunida ertalab yuboriladi.", ru: "Отправляется утром в день рождения ученика.", en: "Sent in the morning on the student's birthday.", de: "Wird morgens am Geburtstag des Schülers gesendet." },
    text: { uz: "Assalomu Alaykum, (STUDENT)! Tug'ilgan kuningiz muborak bo'lsin! (LC) jamoasi", ru: "Здравствуйте, (STUDENT)! Поздравляем с днём рождения! Команда (LC)", en: "Hello, (STUDENT)! Happy birthday! The (LC) team", de: "Hallo, (STUDENT)! Alles Gute zum Geburtstag! Das (LC)-Team" } },
  { key: "absent", label: { uz: "Talaba darsda ishtrok etmadi", ru: "Ученик не был на уроке", en: "Student missed the lesson", de: "Schüler hat den Unterricht verpasst" },
    desc: { uz: "Talaba darsga kelmaganda (davomat belgilangach) ota-onaga yuboriladi.", ru: "Отправляется родителям, когда ученик не пришёл на урок (после отметки посещаемости).", en: "Sent to parents when the student misses a lesson (after attendance is marked).", de: "Wird an die Eltern gesendet, wenn der Schüler den Unterricht verpasst (nach Erfassung der Anwesenheit)." },
    text: { uz: "Assalomu Alaykum! Farzandingiz (STUDENT) bugun (GROUP) darsiga qatnashmadi. (LC)", ru: "Здравствуйте! Ваш ребёнок (STUDENT) сегодня не был на уроке группы (GROUP). (LC)", en: "Hello! Your child (STUDENT) did not attend the (GROUP) lesson today. (LC)", de: "Hallo! Ihr Kind (STUDENT) hat heute nicht am Unterricht der Gruppe (GROUP) teilgenommen. (LC)" } },
];

const VARS: [string, L][] = [
  ["(STUDENT)", { uz: "Talabaning ismi", ru: "Имя ученика", en: "Student's name", de: "Name des Schülers" }],
  ["(GROUP)", { uz: "Guruh nomi", ru: "Название группы", en: "Group name", de: "Gruppenname" }],
  ["(SUM)", { uz: "To'lov miqdori", ru: "Сумма платежа", en: "Payment amount", de: "Zahlungsbetrag" }],
  ["(LC)", { uz: "O'quv markazingiz nomi", ru: "Название вашего учебного центра", en: "Your learning center name", de: "Name Ihres Lernzentrums" }],
  ["(TEACHER)", { uz: "O'qituvchini ismi", ru: "Имя преподавателя", en: "Teacher's name", de: "Name des Lehrers" }],
  ["(TIME)", { uz: "Vaqt", ru: "Время", en: "Time", de: "Uhrzeit" }],
  ["(ROOM)", { uz: "Xona", ru: "Кабинет", en: "Room", de: "Raum" }],
  ["(DAYS)", { uz: "Kunlar", ru: "Дни", en: "Days", de: "Tage" }],
  ["(BALANCE)", { uz: "Talabaning hozirgi balansi", ru: "Текущий баланс ученика", en: "Student's current balance", de: "Aktuelles Guthaben des Schülers" }],
  ["(EX-ID)", { uz: "Talabaning qo'shimcha ID si", ru: "Дополнительный ID ученика", en: "Student's additional ID", de: "Zusätzliche ID des Schülers" }],
  ["(HOURS)", { uz: "Guruhda dars boshlanish va tugash soatlari", ru: "Часы начала и окончания занятий в группе", en: "Group lesson start and end hours", de: "Beginn- und Endzeiten des Gruppenunterrichts" }],
  ["(COURSE)", { uz: "Talaba o'qiyotgan guruh kursi nomi", ru: "Название курса группы, где учится ученик", en: "Name of the course the student's group studies", de: "Name des Kurses, den die Gruppe des Schülers besucht" }],
  ["(INDEBTEDNESS)", { uz: "Talabaning qarzdorligi", ru: "Задолженность ученика", en: "Student's debt", de: "Schulden des Schülers" }],
  ["(GROUP INFORMATION)", { uz: "Guruh haqida ma'lumot", ru: "Информация о группе", en: "Group information", de: "Gruppeninformationen" }],
];

const STORAGE_KEY = "gl-sms-settings";

type State = Record<string, { enabled: boolean; text: string; count: number }>;

function defaults(locale: Locale): State {
  const s: State = {};
  for (const t of SMS_TYPES) s[t.key] = { enabled: false, text: tr(locale, t.text), count: 1 };
  return s;
}

export default function SmsSettings({ locale, centerName }: { locale: Locale; centerName: string }) {
  const [tab, setTab] = useState<"auto" | "templates">("auto");
  const [state, setState] = useState<State>(() => defaults(locale));
  const [active, setActive] = useState(SMS_TYPES[0].key);
  const [saved, setSaved] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // localStorage'dan yuklash
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        setState((cur) => {
          const next = { ...cur };
          for (const k of Object.keys(next)) if (parsed[k]) next[k] = { ...next[k], ...parsed[k] };
          return next;
        });
      }
    } catch { /* ignore */ }
  }, []);

  const persist = (next: State) => {
    setState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const type = SMS_TYPES.find((t) => t.key === active)!;
  const cur = state[active];

  const sample = useMemo<Record<string, string>>(() => ({
    "(STUDENT)": "Ibrohim", "(GROUP)": "A1 ertalabki", "(SUM)": "1 200 000", "(LC)": centerName,
    "(TEACHER)": "Nigora Rashidova", "(TIME)": "09:00", "(ROOM)": "204-xona", "(DAYS)": "Du, Ch, Ju",
    "(BALANCE)": "0", "(EX-ID)": "1024", "(HOURS)": "09:00-10:30", "(COURSE)": "Nemis tili A1",
    "(INDEBTEDNESS)": "300 000", "(GROUP INFORMATION)": "A1 ertalabki, 204-xona",
  }), [centerName]);

  const preview = useMemo(() => {
    let out = cur.text;
    for (const [k, v] of Object.entries(sample)) out = out.split(k).join(v);
    return out;
  }, [cur.text, sample]);

  const len = preview.length;
  const smsCount = Math.max(1, Math.ceil(len / 160));

  const toggle = (key: string) => persist({ ...state, [key]: { ...state[key], enabled: !state[key].enabled } });
  const bump = (key: string, d: number) => persist({ ...state, [key]: { ...state[key], count: Math.max(1, state[key].count + d) } });
  const setText = (v: string) => setState((s) => ({ ...s, [active]: { ...s[active], text: v } }));

  const save = () => { persist({ ...state }); setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const insertVar = (token: string) => {
    const el = areaRef.current;
    const t = cur.text;
    if (el && el.selectionStart != null) {
      const a = el.selectionStart, b = el.selectionEnd;
      setText(t.slice(0, a) + token + t.slice(b));
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + token.length, a + token.length); });
    } else setText(t + token);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">Auto-SMS</h1>

      {/* Tablar */}
      <div className="flex items-center gap-1 border-b border-slate-200/70 dark:border-slate-800">
        {([["auto", "Auto-SMS"], ["templates", tr(locale, { uz: "SMS shablonlar", ru: "SMS-шаблоны", en: "SMS templates", de: "SMS-Vorlagen" })]] as const).map(([k, lb]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("border-b-2 px-4 py-2.5 text-sm font-medium transition",
              tab === k ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
            {lb}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {SMS_TYPES.map((t) => (
            <div key={t.key} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tr(locale, t.label)}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", state[t.key].enabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800")}>
                  {state[t.key].enabled ? tr(locale, { uz: "Yoqilgan", ru: "Включено", en: "Enabled", de: "Aktiviert" }) : tr(locale, { uz: "O'chirilgan", ru: "Отключено", en: "Disabled", de: "Deaktiviert" })}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{state[t.key].text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
          {/* Chap: SMS turi */}
          <div>
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "SMS turi", ru: "Тип SMS", en: "SMS type", de: "SMS-Typ" })}</h3>
            <div className="space-y-2.5">
              {SMS_TYPES.map((t) => (
                <div key={t.key}
                  onClick={() => setActive(t.key)}
                  className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-2xl border bg-white px-4 py-3.5 shadow-card transition dark:bg-slate-900",
                    active === t.key ? "border-brand-400 ring-1 ring-brand-200 dark:border-brand-500/50 dark:ring-brand-500/20" : "border-slate-200/70 hover:border-slate-300 dark:border-slate-800")}>
                  <span className="text-sm text-slate-700 dark:text-slate-200">{tr(locale, t.label)}</span>
                  <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {t.counter && (
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                        <button onClick={() => bump(t.key, 1)} className="px-2 py-1 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">+</button>
                        <span className="min-w-7 px-1 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{state[t.key].count}</span>
                        <button onClick={() => bump(t.key, -1)} className="px-2 py-1 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">−</button>
                      </div>
                    )}
                    <Switch on={state[t.key].enabled} onClick={() => toggle(t.key)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* O'rta: matn + misol */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "SMS matn", ru: "Текст SMS", en: "SMS text", de: "SMS-Text" })}: {tr(locale, type.label)}</h3>
            <textarea
              ref={areaRef}
              value={cur.text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:ring-brand-900"
            />

            <h4 className="mb-2 mt-5 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Yuborilgan SMS misoli", ru: "Пример отправленного SMS", en: "Example of the sent SMS", de: "Beispiel der gesendeten SMS" })}</h4>
            <div className="min-h-[110px] rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
              {preview}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">{tr(locale, { uz: `${len} ta belgi (~ ${smsCount} SMS)`, ru: `${len} символов (~ ${smsCount} SMS)`, en: `${len} characters (~ ${smsCount} SMS)`, de: `${len} Zeichen (~ ${smsCount} SMS)` })}</span>
              <button onClick={save} className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓", de: "Gespeichert ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
              </button>
            </div>
          </div>

          {/* O'ng: tavsif + o'zgaruvchilar */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Tavsif", ru: "Описание", en: "Description", de: "Beschreibung" })}</h3>
            <p className="rounded-xl bg-slate-50/70 px-3.5 py-3 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">{tr(locale, type.desc)}</p>

            <h4 className="mb-2 mt-5 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Mavjud o'zgaruvchilar:", ru: "Доступные переменные:", en: "Available variables:", de: "Verfügbare Variablen:" })}</h4>
            <p className="mb-3 text-xs font-medium leading-relaxed text-rose-500">
              {tr(locale, { uz: "Diqqat! Ushbu o'zgaruvchilar faqat Avto-SMS lar uchun ishlaydi. Ustiga bosib matn ichiga qo'shishingiz mumkin.", ru: "Внимание! Эти переменные работают только для Авто-SMS. Нажмите на переменную, чтобы вставить её в текст.", en: "Attention! These variables work only for Auto-SMS. Click a variable to insert it into the text.", de: "Achtung! Diese Variablen funktionieren nur für Auto-SMS. Klicken Sie auf eine Variable, um sie in den Text einzufügen." })}
            </p>
            <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {VARS.map(([token, desc]) => (
                <button key={token} onClick={() => insertVar(token)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-brand-50 dark:hover:bg-brand-950/30">
                  <span className="shrink-0 font-semibold text-brand-600 dark:text-brand-300">{token}</span>
                  <span className="text-slate-500 dark:text-slate-400">— {tr(locale, desc)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")} aria-pressed={on}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}
