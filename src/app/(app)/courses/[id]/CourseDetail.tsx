"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import CourseFormDrawer from "../CourseFormDrawer";
import { deleteCourse, createLevel, deleteLevel, createMaterial, deleteMaterial, type CourseState } from "../actions";
import { colorFor, loadMeta, saveMetaFor, type CourseMeta } from "../shared";
import CourseLessonsTab, { type VLesson } from "./CourseLessonsTab";
import type { Locale } from "@/lib/constants";

export interface CourseData {
  id: string;
  name: string;
  description: string | null;
  banners: string[];
  monthlyFee: number | null; // oylik narx (bazadan) — qarz hisobida ishlatiladi
  studentsTotal: number;
  levels: { id: string; code: string; name: string; weeks: number | null; academicHours: number | null; passScore: number | null }[];
  /** Sozlamalar > Darajalar katalogi (A1, A2 ...) */
  levelCodes: string[];
  groups: { id: string; name: string; teacher: string | null; students: number; status: string }[];
  materials: { id: string; title: string; kind: string; url: string | null; levelCode: string | null; note: string | null }[];
  courseLessons: VLesson[];
  canManage: boolean;
  /** Kursning O'ZINI tahrirlash/o'chirish (o'qituvchida yo'q — u faqat dars yuklaydi) */
  canEditCourse: boolean;
  locale: Locale;
}

type Tab = "groups" | "lessons" | "levels" | "online" | "materials";

const tabsFor = (locale: Locale): { key: Tab; label: string }[] => [
  { key: "groups", label: tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" }) },
  { key: "lessons", label: tr(locale, { uz: "Darslar", ru: "Уроки", en: "Lessons", de: "Lektionen" }) },
  { key: "levels", label: tr(locale, { uz: "Darajalar", ru: "Уровни", en: "Levels", de: "Niveaus" }) },
  { key: "online", label: tr(locale, { uz: "Onlayn Darslar va materiallar", ru: "Онлайн-уроки и материалы", en: "Online lessons and materials", de: "Online-Lektionen und Materialien" }) },
  { key: "materials", label: tr(locale, { uz: "Materiallar", ru: "Материалы", en: "Materials", de: "Materialien" }) },
];

export default function CourseDetail({ course }: { course: CourseData }) {
  const locale = course.locale;
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const TABS = tabsFor(locale);
  const [meta, setMeta] = useState<CourseMeta>({});
  const [tab, setTab] = useState<Tab>("groups");
  const [editOpen, setEditOpen] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => { setMeta(loadMeta()[course.id] ?? {}); }, [course.id]);

  function onDelete() {
    if (!confirm(T("Ushbu kursni o'chirmoqchimisiz?", "Удалить этот курс?", "Delete this course?", "Diesen Kurs löschen?"))) return;
    startTransition(async () => {
      const res = await deleteCourse(course.id);
      if (res.error === "has-groups") { alert(T("Kursda guruhlar bor. Avval guruhlarni ko'chiring yoki o'chiring.", "В курсе есть группы. Сначала перенесите или удалите группы.", "The course has groups. Move or delete the groups first.", "Der Kurs hat Gruppen. Verschieben oder löschen Sie zuerst die Gruppen.")); return; }
      if (res.error) { alert(T("O'chirishda xatolik.", "Ошибка при удалении.", "Error while deleting.", "Fehler beim Löschen.")); return; }
      router.push("/courses");
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{course.name}</h1>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Chap: kurs kartochkasi */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div
            className="relative flex h-56 flex-col items-center px-4 pt-8"
            style={course.banners.length ? { backgroundImage: `url(${course.banners[activeBanner] ?? course.banners[0]})`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundColor: colorFor(course.id) }}
          >
            {course.banners.length > 0 && <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/25" />}
            {course.canEditCourse && (
              <div className="absolute right-3 top-3 z-10 flex gap-2">
                <button onClick={() => setEditOpen(true)} title={T("Tahrirlash", "Редактировать", "Edit", "Bearbeiten")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/40">
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button onClick={onDelete} disabled={pending} title={T("O'chirish", "Удалить", "Delete", "Löschen")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/40 disabled:opacity-50">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            )}
            <span className="relative mt-2 line-clamp-2 text-center text-xl font-bold text-white drop-shadow">{course.name}</span>
            {course.banners.length === 0 && <Icon name="graduation" className="mb-4 mt-auto h-16 w-16 text-white/85" />}
          </div>

          {/* Banner galereyasi (bir nechta bo'lsa) */}
          {course.banners.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              {course.banners.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setActiveBanner(i)}
                  className={cn("h-12 w-20 shrink-0 rounded-md border-2 bg-cover bg-center transition", i === activeBanner ? "border-brand-500" : "border-transparent opacity-60 hover:opacity-100")}
                  style={{ backgroundImage: `url(${b})` }}
                  aria-label={`${T("Banner", "Баннер", "Banner", "Banner")} ${i + 1}`}
                />
              ))}
            </div>
          )}

          <div className="space-y-4 p-5">
            <InfoRow label={T("Tavzif", "Описание", "Description", "Beschreibung")} value={course.description || "—"} />
            <InfoRow label={T("Narx", "Цена", "Price", "Preis")} value={meta.price != null ? formatMoney(meta.price) : "—"} strong />
            {meta.code && <InfoRow label={T("Kurs kodi", "Код курса", "Course code", "Kurscode")} value={meta.code} />}
            <InfoRow label={T("Talabalar", "Студенты", "Students", "Schüler")} value={String(course.studentsTotal)} strong />
            <InfoRow label={T("Dars davomiyligi", "Длительность урока", "Lesson duration", "Unterrichtsdauer")} value={meta.lessonDuration || "—"} strong />
            {meta.months != null && <InfoRow label={T("Kurs davomiyligi", "Длительность курса", "Course duration", "Kursdauer")} value={T(`${meta.months} oy`, `${meta.months} мес.`, `${meta.months} months`, `${meta.months} Monate`)} strong />}
          </div>
        </div>

        {/* O'ng: tab'lar */}
        <div>
          <div className="mb-5 flex flex-wrap gap-6 border-b border-slate-200/70 dark:border-slate-800">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative -mb-px whitespace-nowrap pb-3 text-sm font-medium transition",
                  tab === t.key
                    ? "text-brand-600 dark:text-brand-300"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {t.label}
                {tab === t.key && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t bg-brand-500" />}
              </button>
            ))}
          </div>

          {tab === "groups" && (
            course.groups.length === 0 ? (
              <InfoBox>{T("Ushbu kursdan foydalanadigan guruhlar yo'q", "Нет групп, использующих этот курс", "No groups use this course", "Keine Gruppen verwenden diesen Kurs")}</InfoBox>
            ) : (
              <div className="space-y-2">
                {course.groups.map((g) => (
                  <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-card transition hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{g.name}</div>
                      <div className="text-xs text-slate-400">{T("O'qituvchi", "Преподаватель", "Teacher", "Lehrer")}: {g.teacher ?? "—"}</div>
                    </div>
                    <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300">{g.students} {T("o'quvchi", "уч.", "students", "Schüler")}</span>
                  </Link>
                ))}
              </div>
            )
          )}

          {tab === "lessons" && (
            <CourseLessonsTab programId={course.id} lessons={course.courseLessons} canManage={course.canManage} locale={course.locale} levelCodes={course.levelCodes} />
          )}

          {tab === "levels" && (
            <div className="space-y-3">
              <LevelForm programId={course.id} levelCodes={course.levelCodes} locale={locale} />
              {course.levels.length === 0 ? (
                <InfoBox>{T("Ushbu kursda darajalar yo'q", "В этом курсе нет уровней", "This course has no levels", "Dieser Kurs hat keine Niveaus")}</InfoBox>
              ) : (
                <div className="space-y-2">
                  {course.levels.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{l.code}</span>
                        <span className="ml-2 text-sm text-slate-500">{l.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-400">
                          {l.weeks ?? "—"} {T("hafta", "нед.", "weeks", "Wochen")} · {l.academicHours ?? "—"} {T("soat", "ч.", "hours", "Std.")} · {T("o'tish", "проходной", "pass", "Bestehen")} {l.passScore ?? "—"}%
                        </div>
                        <DelBtn onDelete={() => deleteLevel(l.id)} locale={locale} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "online" && <InfoBox>{T("Hozircha onlayn darslar va materiallar yo'q", "Онлайн-уроков и материалов пока нет", "No online lessons or materials yet", "Noch keine Online-Lektionen oder Materialien")}</InfoBox>}

          {tab === "materials" && (
            <div className="space-y-3">
              <MaterialForm programId={course.id} levelCodes={course.levelCodes} locale={locale} />
              {course.materials.length === 0 ? (
                <InfoBox>{T("Hozircha materiallar yo'q", "Материалов пока нет", "No materials yet", "Noch keine Materialien")}</InfoBox>
              ) : (
                <div className="space-y-2">
                  {course.materials.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300"><Icon name={kindIcon(m.kind)} className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                            {m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 hover:underline dark:hover:text-brand-300">{m.title}</a> : m.title}
                          </div>
                          <div className="truncate text-xs text-slate-400">{kindLabel(m.kind, locale)}{m.levelCode ? ` · ${m.levelCode}` : ""}{m.note ? ` · ${m.note}` : ""}</div>
                        </div>
                      </div>
                      <DelBtn onDelete={() => deleteMaterial(m.id)} locale={locale} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CourseFormDrawer
        mode="edit"
        locale={course.locale}
        // Narx bazadan keladi, qolgan meta (kod, davomiylik) hozircha brauzerda
        initial={{ id: course.id, name: course.name, description: course.description, meta: { ...meta, price: course.monthlyFee ?? undefined }, banners: course.banners }}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(id, m) => setMeta(saveMetaFor(id, m)[id] ?? m)}
      />
    </div>
  );
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-sm text-slate-400">{label}</div>
      <div className={cn("mt-0.5", strong ? "text-base font-semibold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300")}>{value}</div>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-blue-50 px-5 py-4 text-sm font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
      {children}
    </div>
  );
}

const fInp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
const kindIcon = (k: string) => (k === "VIDEO" ? "video" : k === "FILE" ? "download" : k === "DOC" ? "clipboard" : "link");
const kindLabel = (k: string, locale: Locale) =>
  k === "VIDEO" ? "Video"
  : k === "FILE" ? tr(locale, { uz: "Fayl", ru: "Файл", en: "File", de: "Datei" })
  : k === "DOC" ? tr(locale, { uz: "Hujjat", ru: "Документ", en: "Document", de: "Dokument" })
  : tr(locale, { uz: "Havola", ru: "Ссылка", en: "Link", de: "Link" });

function LevelForm({ programId, levelCodes, locale }: { programId: string; levelCodes: string[]; locale: Locale }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [state, action, pending] = useActionState<CourseState, FormData>(createLevel.bind(null, programId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end gap-2.5">
        <input name="code" required placeholder={T("Kod (A1.1)", "Код (A1.1)", "Code (A1.1)", "Code (A1.1)")} list="level-codes" className={cn(fInp, "w-28")} />
        <datalist id="level-codes">{levelCodes.map((c) => <option key={c} value={c} />)}</datalist>
        <input name="name" required placeholder={T("Daraja nomi", "Название уровня", "Level name", "Niveauname")} className={cn(fInp, "min-w-[150px] flex-1")} />
        <input name="weeks" type="number" min="0" placeholder={T("Hafta", "Недели", "Weeks", "Wochen")} className={cn(fInp, "w-20")} />
        <input name="academicHours" type="number" min="0" placeholder={T("Soat", "Часы", "Hours", "Stunden")} className={cn(fInp, "w-20")} />
        <input name="passScore" type="number" min="0" max="100" placeholder={T("O'tish %", "Проходной %", "Pass %", "Bestehen %")} className={cn(fInp, "w-24")} />
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : T("+ Daraja", "+ Уровень", "+ Level", "+ Niveau")}</button>
      </div>
      {state.error && <p className="mt-2 text-sm text-rose-500">{state.error === "duplicate" ? T("Bu kod allaqachon bor", "Этот код уже существует", "This code already exists", "Dieser Code existiert bereits") : state.error === "forbidden" ? T("Ruxsat yo'q", "Нет доступа", "No permission", "Keine Berechtigung") : T("Kod va nomni to'ldiring", "Заполните код и название", "Fill in the code and name", "Code und Name ausfüllen")}</p>}
    </form>
  );
}

function MaterialForm({ programId, levelCodes, locale }: { programId: string; levelCodes: string[]; locale: Locale }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [state, action, pending] = useActionState<CourseState, FormData>(createMaterial.bind(null, programId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end gap-2.5">
        <input name="title" required placeholder={T("Sarlavha", "Заголовок", "Title", "Titel")} className={cn(fInp, "min-w-[150px] flex-1")} />
        <select name="kind" defaultValue="LINK" className={cn(fInp, "w-32")}>
          <option value="LINK">{T("Havola", "Ссылка", "Link", "Link")}</option>
          <option value="VIDEO">Video</option>
          <option value="FILE">{T("Fayl", "Файл", "File", "Datei")}</option>
          <option value="DOC">{T("Hujjat", "Документ", "Document", "Dokument")}</option>
        </select>
        <input name="url" placeholder={T("Havola (https://...)", "Ссылка (https://...)", "Link (https://...)", "Link (https://...)")} className={cn(fInp, "min-w-[170px] flex-1")} />
        <select name="levelCode" defaultValue="" className={cn(fInp, "w-32")}>
          <option value="">{T("Daraja (—)", "Уровень (—)", "Level (—)", "Niveau (—)")}</option>
          {levelCodes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : T("+ Material", "+ Материал", "+ Material", "+ Material")}</button>
      </div>
      {state.error && <p className="mt-2 text-sm text-rose-500">{state.error === "forbidden" ? T("Ruxsat yo'q", "Нет доступа", "No permission", "Keine Berechtigung") : T("Sarlavhani to'ldiring", "Заполните заголовок", "Fill in the title", "Titel ausfüllen")}</p>}
    </form>
  );
}

function DelBtn({ onDelete, locale }: { onDelete: () => Promise<{ ok?: boolean; error?: string }>; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => { if (window.confirm(tr(locale, { uz: "O'chirasizmi?", ru: "Удалить?", en: "Delete?", de: "Löschen?" }))) start(async () => { const r = await onDelete(); if (r.ok) router.refresh(); }); }}
      disabled={pending}
      title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10"
    >
      <Icon name="trash" className="h-4 w-4" />
    </button>
  );
}
