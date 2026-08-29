"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { PLATFORMS, COUNTRIES, flagOf } from "./platforms";
import { createVacancyLink, addLinkToVacancy } from "./actions";
import type { CreatedLink, VacancyOption } from "./types";
import { MAX_OPTIONS, MAX_QUESTIONS, type ApplyQuestion } from "./questions";

const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

export default function CreateLinkModal({ locale, mode, vacancies, courses, preselectVacancyId, onClose, onDone }: {
  locale: Locale;
  mode: "new" | "existing";
  vacancies: VacancyOption[];
  courses: string[]; // o'quv markaz kurslari (Program.name) — ro'yxatdan tanlash uchun
  preselectVacancyId: string | null;
  onClose: () => void;
  onDone: (links: CreatedLink[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [pickedCourse, setPickedCourse] = useState(""); // "" = ro'yxatdan tanlanmagan (qo'lda yoziladi)
  const [vacancyId, setVacancyId] = useState(preselectVacancyId ?? "");
  const [picked, setPicked] = useState<string[]>(["telegram"]);
  const [questions, setQuestions] = useState<ApplyQuestion[]>([]);

  const selectedVacancy = vacancies.find((v) => v.id === vacancyId) ?? null;

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!mounted) return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (picked.length === 0) { setError(tr(locale, { uz: "Kamida bitta platforma tanlang", ru: "Выберите хотя бы одну платформу", en: "Select at least one platform", de: "Wählen Sie mindestens eine Plattform" })); return; }
    for (const p of picked) fd.append("platforms", p);
    // Savollar JSON matn sifatida yuboriladi (bo'sh savollar serverda tashlanadi)
    fd.set("questions", JSON.stringify(questions.filter((x) => x.q.trim())));
    if (mode === "existing" && !fd.get("vacancyId")) { setError(tr(locale, { uz: "Kursni tanlang", ru: "Выберите курс", en: "Select a course", de: "Wählen Sie einen Kurs" })); return; }
    start(async () => {
      const r = mode === "new" ? await createVacancyLink(fd) : await addLinkToVacancy(fd);
      if (r.ok) onDone(r.links ?? []);
      else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" }));
    });
  };

  const togglePlatform = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Icon name="link" className="h-5 w-5" /></span>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {mode === "new"
                ? tr(locale, { uz: "Yangi kurs + Link", ru: "Новый курс + Ссылка", en: "New course + Link", de: "Neuer Kurs + Link" })
                : tr(locale, { uz: "Mavjud kursga link", ru: "Ссылка к существующему курсу", en: "Link to existing course", de: "Link zu bestehendem Kurs" })}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"><Icon name="close" className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto px-5 py-4">
          {mode === "existing" ? (
            <>
              <Field label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })} req>
                <select name="vacancyId" value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className={inp}>
                  <option value="">{tr(locale, { uz: "— tanlang —", ru: "— выберите —", en: "— select —", de: "— auswählen —" })}</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>{v.title} — {v.country ?? tr(locale, { uz: "Noma'lum", ru: "Неизвестно", en: "Unknown", de: "Unbekannt" })}</option>
                  ))}
                </select>
              </Field>
              {vacancies.length === 0 && (
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Icon name="alert" className="h-3 w-3" /> {tr(locale, { uz: "Avval kurs havolasini yarating", ru: "Сначала создайте курс", en: "Create a course first", de: "Erstellen Sie zuerst einen Kurs" })}
                </p>
              )}
              {selectedVacancy && (
                <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="mb-1 text-xs text-slate-400">{tr(locale, { uz: "Tanlangan kurs", ru: "Выбранный курс", en: "Selected course", de: "Ausgewählter Kurs" })}</p>
                  <div className="flex items-center gap-2">
                    <span>{flagOf(selectedVacancy.countryCode, selectedVacancy.country)}</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{selectedVacancy.title}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Kurs havolasi — mahalliy, shuning uchun davlat avtomatik O'zbekiston */}
              <input type="hidden" name="country" value="O'zbekiston" />
              <input type="hidden" name="countryCode" value="uz" />

              <Field label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })} req>
                {courses.length > 0 && (
                  <select
                    value={pickedCourse}
                    onChange={(e) => { setPickedCourse(e.target.value); setTitle(e.target.value); }}
                    className={cn(inp, "mb-2")}
                  >
                    <option value="">{tr(locale, { uz: "— ro'yxatdan tanlang —", ru: "— выберите из списка —", en: "— select from list —", de: "— aus der Liste wählen —" })}</option>
                    {courses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <input
                  name="title"
                  required
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setPickedCourse(""); }}
                  placeholder={tr(locale, { uz: "masalan: Nemis tili A1–B2", ru: "например: Немецкий язык A1–B2", en: "e.g. German A1–B2", de: "z. B. Deutsch A1–B2" })}
                  className={inp}
                  autoFocus
                />
                {courses.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {tr(locale, { uz: "Ro'yxatda yo'q kursni qo'lda yozishingiz mumkin", ru: "Курс, которого нет в списке, можно вписать вручную", en: "You can type a course that is not in the list", de: "Sie können einen nicht gelisteten Kurs manuell eingeben" })}
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={tr(locale, { uz: "Daraja / yo'nalish", ru: "Уровень / направление", en: "Level / track", de: "Niveau / Richtung" })}>
                  <input name="jobTitle" placeholder={tr(locale, { uz: "A1 / B2 / IELTS ...", ru: "A1 / B2 / IELTS ...", en: "A1 / B2 / IELTS ...", de: "A1 / B2 / IELTS ..." })} className={inp} />
                </Field>
                <Field label={tr(locale, { uz: "Narxi (ixtiyoriy)", ru: "Цена (необяз.)", en: "Price (optional)", de: "Preis (optional)" })}>
                  <input name="salary" placeholder={tr(locale, { uz: "masalan: 500 000 so'm/oy", ru: "например: 500 000 сум/мес", en: "e.g. 500 000 UZS/mo", de: "z. B. 500 000 UZS/Monat" })} className={inp} />
                </Field>
              </div>

              <Field label={tr(locale, { uz: "Tavsif (ixtiyoriy)", ru: "Описание (необяз.)", en: "Description (optional)", de: "Beschreibung (optional)" })}>
                <textarea name="description" rows={3} placeholder={tr(locale, { uz: "Dars jadvali, o'qituvchi, kurs davomiyligi...", ru: "Расписание, преподаватель, длительность курса...", en: "Schedule, teacher, course duration...", de: "Stundenplan, Lehrer, Kursdauer..." })} className={cn(inp, "resize-none")} />
              </Field>

              {/* Ariza formasidagi qo'shimcha savollar */}
              <QuestionsBuilder locale={locale} questions={questions} onChange={setQuestions} />

              {title.trim() && (
                <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="mb-1.5 text-xs text-slate-400">{tr(locale, { uz: "Yaratiladi:", ru: "Будет создано:", en: "Will be created:", de: "Wird erstellt:" })}</p>
                  <div className="flex items-center gap-2">
                    <Icon name="book" className="h-4 w-4 text-brand-500" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Icon name="link" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Link sozlamalari", ru: "Настройки ссылки", en: "Link settings", de: "Linkeinstellungen" })}
            </p>
            <Field label={tr(locale, { uz: "Link nomi (ixtiyoriy)", ru: "Название ссылки (необяз.)", en: "Link name (optional)", de: "Linkname (optional)" })}>
              <input name="name" placeholder={tr(locale, { uz: "masalan: Telegram reklama", ru: "например: Реклама в Telegram", en: "e.g. Telegram ad", de: "z. B. Telegram-Anzeige" })} className={inp} />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              {tr(locale, { uz: "Platformalar", ru: "Платформы", en: "Platforms", de: "Plattformen" })} <span className="text-rose-500">*</span>
            </span>
            <p className="mb-2 text-xs text-slate-400">{tr(locale, { uz: "Har bir platforma uchun alohida kod yaratiladi — qaysi kanal ko'proq ariza berayotganini ko'rasiz.", ru: "Для каждой платформы создаётся отдельный код — вы увидите, какой канал даёт больше заявок.", en: "A separate code is generated per platform — you will see which channel brings more applications.", de: "Für jede Plattform wird ein eigener Code erstellt — so sehen Sie, welcher Kanal mehr Bewerbungen bringt." })}</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const sel = picked.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => togglePlatform(p.key)}
                    className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                      sel ? "border-current" : "border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:hover:text-slate-300")}
                    style={sel ? { background: `${p.color}1a`, color: p.color } : undefined}
                  >
                    <Icon name={p.icon} className="h-3.5 w-3.5" style={sel ? undefined : { color: p.color }} /> {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 dark:border-slate-700">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Qo'shimcha (UTM, muddat)", ru: "Дополнительно (UTM, срок)", en: "Additional (UTM, expiry)", de: "Zusätzlich (UTM, Ablauf)" })}</summary>
            <div className="space-y-3 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
              <div className="grid grid-cols-3 gap-2">
                <Field label="UTM source"><input name="utmSource" placeholder="telegram" className={inp} /></Field>
                <Field label="UTM medium"><input name="utmMedium" placeholder="social" className={inp} /></Field>
                <Field label="UTM campaign"><input name="utmCampaign" placeholder="q3-2026" className={inp} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={tr(locale, { uz: "Amal muddati", ru: "Срок действия", en: "Expiry date", de: "Ablaufdatum" })}><input name="expiresAt" type="date" className={inp} /></Field>
                <Field label={tr(locale, { uz: "Ariza chegarasi", ru: "Лимит заявок", en: "Application limit", de: "Bewerbungslimit" })}><input name="maxSubmissions" type="number" min={0} placeholder={tr(locale, { uz: "cheksiz", ru: "без лимита", en: "unlimited", de: "unbegrenzt" })} className={inp} /></Field>
              </div>
            </div>
          </details>

          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
          </button>
          <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            <Icon name={pending ? "refresh" : "plus"} className={cn("h-4 w-4", pending && "animate-spin")} />
            {pending ? tr(locale, { uz: "Yaratilmoqda...", ru: "Создание...", en: "Creating...", de: "Wird erstellt..." }) : tr(locale, { uz: "Yaratish", ru: "Создать", en: "Create", de: "Erstellen" })}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">{label}{req && <span className="text-rose-500"> *</span>}</span>
      {children}
    </label>
  );
}

// ─── Ariza formasidagi qo'shimcha savollar ───
// Har bir savol: erkin matn yoki variantli (radio). Variantli savolda kamida bitta variant kerak.
function QuestionsBuilder({ locale, questions, onChange }: {
  locale: Locale;
  questions: ApplyQuestion[];
  onChange: (q: ApplyQuestion[]) => void;
}) {
  const patch = (i: number, next: Partial<ApplyQuestion>) =>
    onChange(questions.map((q, k) => (k === i ? { ...q, ...next } : q)));
  const remove = (i: number) => onChange(questions.filter((_, k) => k !== i));
  const add = () => onChange([...questions, { q: "", type: "text", required: false }]);

  const small = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Icon name="clipboard" className="h-3.5 w-3.5" />
          {tr(locale, { uz: "Ariza savollari (ixtiyoriy)", ru: "Вопросы в заявке (необяз.)", en: "Application questions (optional)", de: "Bewerbungsfragen (optional)" })}
        </p>
        {questions.length < MAX_QUESTIONS && (
          <button type="button" onClick={add} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300">
            <Icon name="plus" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Savol qo'shish", ru: "Добавить вопрос", en: "Add question", de: "Frage hinzufügen" })}
          </button>
        )}
      </div>

      {questions.length === 0 ? (
        <p className="text-[11px] text-slate-400">
          {tr(locale, {
            uz: "Ism va telefondan tashqari savol so'ramoqchi bo'lsangiz qo'shing (masalan: \"Qaysi vaqt qulay?\").",
            ru: "Добавьте вопросы помимо имени и телефона (например: «Какое время удобно?»).",
            en: "Add questions beyond name and phone (e.g. \"Which time suits you?\").",
            de: "Fügen Sie Fragen über Name und Telefon hinaus hinzu (z. B. „Welche Zeit passt Ihnen?\").",
          })}
        </p>
      ) : (
        <div className="space-y-2.5">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-start gap-2">
                <input
                  value={q.q}
                  onChange={(e) => patch(i, { q: e.target.value })}
                  placeholder={tr(locale, { uz: `${i + 1}-savol`, ru: `Вопрос ${i + 1}`, en: `Question ${i + 1}`, de: `Frage ${i + 1}` })}
                  className={small}
                />
                <button type="button" onClick={() => remove(i)} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Remove", de: "Entfernen" })} className="mt-0.5 shrink-0 text-slate-400 transition hover:text-rose-500">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                {/* Javob turi */}
                <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  {(["text", "choice"] as const).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => patch(i, { type: tp, options: tp === "choice" ? (q.options?.length ? q.options : [""]) : undefined })}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-medium transition",
                        q.type === tp ? "bg-brand-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300",
                      )}
                    >
                      {tp === "text"
                        ? tr(locale, { uz: "Yoziladi", ru: "Ввод текста", en: "Free text", de: "Freitext" })
                        : tr(locale, { uz: "Variantli", ru: "Варианты", en: "Choices", de: "Auswahl" })}
                    </button>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={!!q.required} onChange={(e) => patch(i, { required: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-600" />
                  {tr(locale, { uz: "Majburiy", ru: "Обязательный", en: "Required", de: "Erforderlich" })}
                </label>
              </div>

              {/* Variantlar */}
              {q.type === "choice" && (
                <div className="mt-2 space-y-1.5">
                  {(q.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300 dark:border-slate-600" />
                      <input
                        value={opt}
                        onChange={(e) => patch(i, { options: (q.options ?? []).map((o, k) => (k === oi ? e.target.value : o)) })}
                        placeholder={tr(locale, { uz: `${oi + 1}-variant`, ru: `Вариант ${oi + 1}`, en: `Option ${oi + 1}`, de: `Option ${oi + 1}` })}
                        className={small}
                      />
                      <button
                        type="button"
                        onClick={() => patch(i, { options: (q.options ?? []).filter((_, k) => k !== oi) })}
                        className="shrink-0 text-slate-400 transition hover:text-rose-500"
                      >
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {(q.options?.length ?? 0) < MAX_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => patch(i, { options: [...(q.options ?? []), ""] })}
                      className="ml-4.5 flex items-center gap-1 text-[11px] font-medium text-brand-600 transition hover:underline dark:text-brand-400"
                    >
                      <Icon name="plus" className="h-3 w-3" /> {tr(locale, { uz: "Variant qo'shish", ru: "Добавить вариант", en: "Add option", de: "Option hinzufügen" })}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
