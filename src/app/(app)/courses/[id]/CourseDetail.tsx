"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/constants";
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

const TABS: { key: Tab; label: string }[] = [
  { key: "groups", label: "Guruhlar" },
  { key: "lessons", label: "Darslar" },
  { key: "levels", label: "Darajalar" },
  { key: "online", label: "Onlayn Darslar va materiallar" },
  { key: "materials", label: "Materials" },
];

export default function CourseDetail({ course }: { course: CourseData }) {
  const [meta, setMeta] = useState<CourseMeta>({});
  const [tab, setTab] = useState<Tab>("groups");
  const [editOpen, setEditOpen] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => { setMeta(loadMeta()[course.id] ?? {}); }, [course.id]);

  function onDelete() {
    if (!confirm("Ushbu kursni o'chirmoqchimisiz?")) return;
    startTransition(async () => {
      const res = await deleteCourse(course.id);
      if (res.error === "has-groups") { alert("Kursda guruhlar bor. Avval guruhlarni ko'chiring yoki o'chiring."); return; }
      if (res.error) { alert("O'chirishда xatolik."); return; }
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
                <button onClick={() => setEditOpen(true)} title="Tahrirlash" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/40">
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button onClick={onDelete} disabled={pending} title="O'chirish" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/40 disabled:opacity-50">
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
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
          )}

          <div className="space-y-4 p-5">
            <InfoRow label="Tavzif" value={course.description || "—"} />
            <InfoRow label="Narx" value={meta.price != null ? formatMoney(meta.price) : "—"} strong />
            {meta.code && <InfoRow label="Kurs kodi" value={meta.code} />}
            <InfoRow label="Talabalar" value={String(course.studentsTotal)} strong />
            <InfoRow label="Dars davomiyligi" value={meta.lessonDuration || "—"} strong />
            {meta.months != null && <InfoRow label="Kurs davomiyligi" value={`${meta.months} oy`} strong />}
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
              <InfoBox>Ushbu kursdan foydalanadigan guruhlar yo&apos;q</InfoBox>
            ) : (
              <div className="space-y-2">
                {course.groups.map((g) => (
                  <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-card transition hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{g.name}</div>
                      <div className="text-xs text-slate-400">O&apos;qituvchi: {g.teacher ?? "—"}</div>
                    </div>
                    <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-300">{g.students} o&apos;quvchi</span>
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
              <LevelForm programId={course.id} levelCodes={course.levelCodes} />
              {course.levels.length === 0 ? (
                <InfoBox>Ushbu kursda darajalar yo&apos;q</InfoBox>
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
                          {l.weeks ?? "—"} hafta · {l.academicHours ?? "—"} soat · o&apos;tish {l.passScore ?? "—"}%
                        </div>
                        <DelBtn onDelete={() => deleteLevel(l.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "online" && <InfoBox>Hozircha onlayn darslar va materiallar yo&apos;q</InfoBox>}

          {tab === "materials" && (
            <div className="space-y-3">
              <MaterialForm programId={course.id} levelCodes={course.levelCodes} />
              {course.materials.length === 0 ? (
                <InfoBox>Hozircha materiallar yo&apos;q</InfoBox>
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
                          <div className="truncate text-xs text-slate-400">{kindLabel(m.kind)}{m.levelCode ? ` · ${m.levelCode}` : ""}{m.note ? ` · ${m.note}` : ""}</div>
                        </div>
                      </div>
                      <DelBtn onDelete={() => deleteMaterial(m.id)} />
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
const kindLabel = (k: string) => (k === "VIDEO" ? "Video" : k === "FILE" ? "Fayl" : k === "DOC" ? "Hujjat" : "Havola");

function LevelForm({ programId, levelCodes }: { programId: string; levelCodes: string[] }) {
  const [state, action, pending] = useActionState<CourseState, FormData>(createLevel.bind(null, programId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end gap-2.5">
        <input name="code" required placeholder="Kod (A1.1)" list="level-codes" className={cn(fInp, "w-28")} />
        <datalist id="level-codes">{levelCodes.map((c) => <option key={c} value={c} />)}</datalist>
        <input name="name" required placeholder="Daraja nomi" className={cn(fInp, "min-w-[150px] flex-1")} />
        <input name="weeks" type="number" min="0" placeholder="Hafta" className={cn(fInp, "w-20")} />
        <input name="academicHours" type="number" min="0" placeholder="Soat" className={cn(fInp, "w-20")} />
        <input name="passScore" type="number" min="0" max="100" placeholder="O'tish %" className={cn(fInp, "w-24")} />
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "+ Daraja"}</button>
      </div>
      {state.error && <p className="mt-2 text-sm text-rose-500">{state.error === "duplicate" ? "Bu kod allaqachon bor" : state.error === "forbidden" ? "Ruxsat yo'q" : "Kod va nomni to'ldiring"}</p>}
    </form>
  );
}

function MaterialForm({ programId, levelCodes }: { programId: string; levelCodes: string[] }) {
  const [state, action, pending] = useActionState<CourseState, FormData>(createMaterial.bind(null, programId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end gap-2.5">
        <input name="title" required placeholder="Sarlavha" className={cn(fInp, "min-w-[150px] flex-1")} />
        <select name="kind" defaultValue="LINK" className={cn(fInp, "w-32")}>
          <option value="LINK">Havola</option>
          <option value="VIDEO">Video</option>
          <option value="FILE">Fayl</option>
          <option value="DOC">Hujjat</option>
        </select>
        <input name="url" placeholder="Havola (https://...)" className={cn(fInp, "min-w-[170px] flex-1")} />
        <select name="levelCode" defaultValue="" className={cn(fInp, "w-32")}>
          <option value="">Daraja (—)</option>
          {levelCodes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "+ Material"}</button>
      </div>
      {state.error && <p className="mt-2 text-sm text-rose-500">{state.error === "forbidden" ? "Ruxsat yo'q" : "Sarlavhani to'ldiring"}</p>}
    </form>
  );
}

function DelBtn({ onDelete }: { onDelete: () => Promise<{ ok?: boolean; error?: string }> }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => { if (window.confirm("O'chirasizmi?")) start(async () => { const r = await onDelete(); if (r.ok) router.refresh(); }); }}
      disabled={pending}
      title="O'chirish"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10"
    >
      <Icon name="trash" className="h-4 w-4" />
    </button>
  );
}
