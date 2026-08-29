"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "../../_components/Icon";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { createCourseLesson, updateCourseLesson, deleteCourseLesson, moveCourseLesson, type LessonInput } from "./lessonActions";
import { setLessonTaught } from "../../groups/[id]/lessonProgressActions";

export interface VLesson {
  id: string; order: number; levelCode?: string | null; title: string; topic: string | null;
  videoUrl: string | null; materialUrl: string | null; assignment: string | null; assignmentFileUrl: string | null; homework: string | null; homeworkFileUrl: string | null;
}

async function uploadFile(file: File): Promise<{ url: string } | { error: string }> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) { const j = await res.json().catch(() => ({})); return { error: j.error === "too_large" ? "too_large" : "upload_failed" }; }
  const j = await res.json();
  return { url: j.url as string };
}

export default function CourseLessonsTab({ programId, lessons, canManage, locale, groupId, progress }: { programId: string; lessons: VLesson[]; canManage: boolean; locale: Locale; groupId?: string; progress?: Record<string, boolean> }) {
  const [edit, setEdit] = useState<VLesson | null>(null);
  const [open, setOpen] = useState(false);
  const openNew = () => { setEdit(null); setOpen(true); };
  const openEdit = (l: VLesson) => { setEdit(l); setOpen(true); };
  const taughtCount = groupId ? lessons.filter((l) => progress?.[l.id]).length : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Darslar ketma-ketligi — mavzu, video, topshiriq, uy vazifasi", ru: "Последовательность уроков — тема, видео, задание, домашка", en: "Lesson sequence — topic, video, assignment, homework" })}</p>
        {groupId && lessons.length > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{tr(locale, { uz: "O'tildi", ru: "Пройдено", en: "Taught" })}: {taughtCount}/{lessons.length}</span>
        )}
        {canManage && (
          <button onClick={openNew} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangi dars", ru: "Новый урок", en: "New lesson" })}
          </button>
        )}
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
          <div className="text-3xl opacity-30">🎬</div>
          <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Hali dars qo'shilmagan", ru: "Уроки ещё не добавлены", en: "No lessons yet" })}</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {lessons.map((l, i) => (
            <LessonCard key={l.id} lesson={l} index={i} count={lessons.length} canManage={canManage} locale={locale} onEdit={() => openEdit(l)} groupId={groupId} taught={!!progress?.[l.id]} />
          ))}
        </ol>
      )}

      {open && canManage && <LessonDrawer programId={programId} initial={edit} locale={locale} onClose={() => setOpen(false)} />}
    </div>
  );
}

function LessonCard({ lesson: l, index, count, canManage, locale, onEdit, groupId, taught }: { lesson: VLesson; index: number; count: number; canManage: boolean; locale: Locale; onEdit: () => void; groupId?: string; taught?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, start] = useTransition();
  const [isTaught, setIsTaught] = useState(!!taught);
  const router = useRouter();
  const del = () => { if (confirm(tr(locale, { uz: "Bu darsni o'chirasizmi?", ru: "Удалить этот урок?", en: "Delete this lesson?" }))) start(async () => { await deleteCourseLesson(l.id); router.refresh(); }); };
  const move = (dir: "up" | "down") => start(async () => { await moveCourseLesson(l.id, dir); router.refresh(); });
  const toggleTaught = () => { if (!groupId) return; const next = !isTaught; setIsTaught(next); start(async () => { await setLessonTaught(groupId, l.id, next); }); };

  const hasDetails = l.topic || l.videoUrl || l.assignment || l.assignmentFileUrl || l.homework || l.homeworkFileUrl || l.materialUrl;

  const done = !!(groupId && isTaught);
  return (
    <li className={cn("group/ls overflow-hidden rounded-2xl border bg-white shadow-card transition hover:shadow-soft dark:bg-slate-900", pending && "opacity-60", done ? "border-emerald-300 dark:border-emerald-800/70" : "border-slate-200/70 dark:border-slate-800")}>
      <div className="flex items-center gap-3.5 p-4">
        {/* Tartib / o'tildi belgisi */}
        {groupId && canManage ? (
          <button onClick={toggleTaught} title={tr(locale, { uz: "O'tildi deb belgilash", ru: "Отметить пройденным", en: "Mark as taught" })}
            className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold shadow-sm transition", done ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-500/20")}>
            {done ? <Icon name="check" className="h-5 w-5" /> : l.order}
          </button>
        ) : (
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold text-white shadow-sm", done ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-brand-500 to-brand-600")}>{done ? <Icon name="check" className="h-5 w-5" /> : l.order}</span>
        )}

        {/* Sarlavha + belgilar */}
        <button onClick={() => hasDetails && setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{l.title}</span>
            {hasDetails && <Icon name="chevronDown" className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", expanded && "rotate-180")} />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {l.videoUrl && <Tag emoji="🎬" text={tr(locale, { uz: "Video", ru: "Видео", en: "Video" })} tone="rose" />}
            {(l.assignment || l.assignmentFileUrl) && <Tag emoji="📝" text={tr(locale, { uz: "Topshiriq", ru: "Задание", en: "Assignment" })} tone="amber" />}
            {(l.homework || l.homeworkFileUrl) && <Tag emoji="🏠" text={tr(locale, { uz: "Uy vazifa", ru: "Домашка", en: "Homework" })} tone="emerald" />}
            {l.materialUrl && <Tag emoji="📎" text={tr(locale, { uz: "Material", ru: "Материал", en: "Material" })} tone="blue" />}
            {!hasDetails && <span className="text-xs text-slate-400">{tr(locale, { uz: "Ma'lumot qo'shilmagan", ru: "Нет данных", en: "No details yet" })}</span>}
          </div>
        </button>

        {/* Amallar */}
        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <div className="mr-1 flex flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={() => move("up")} disabled={index === 0} className="flex h-4 w-7 items-center justify-center text-[10px] text-slate-400 transition hover:bg-slate-100 hover:text-brand-500 disabled:opacity-25 dark:hover:bg-slate-800" title={tr(locale, { uz: "Yuqoriga", ru: "Вверх", en: "Up" })}>▲</button>
              <button onClick={() => move("down")} disabled={index === count - 1} className="flex h-4 w-7 items-center justify-center border-t border-slate-200 text-[10px] text-slate-400 transition hover:bg-slate-100 hover:text-brand-500 disabled:opacity-25 dark:border-slate-700 dark:hover:bg-slate-800" title={tr(locale, { uz: "Pastga", ru: "Вниз", en: "Down" })}>▼</button>
            </div>
            <button onClick={onEdit} className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-950/30">
              <Icon name="edit" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Tahrir", ru: "Изм.", en: "Edit" })}
            </button>
            <button onClick={del} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10" title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })}><Icon name="fileX" className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4 dark:border-slate-800 dark:bg-white/[0.02]">
          {l.topic && <Field label={tr(locale, { uz: "Mavzu", ru: "Тема", en: "Topic" })} value={l.topic} />}
          {l.videoUrl && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><span>🎬</span> {tr(locale, { uz: "Dars videosi", ru: "Видео урока", en: "Lesson video" })}</div>
              <video controls preload="metadata" className="max-h-[360px] w-full rounded-xl bg-black shadow-sm" src={l.videoUrl} />
            </div>
          )}
          {(l.assignment || l.assignmentFileUrl) && (
            <div>
              {l.assignment && <Field label={tr(locale, { uz: "Dars topshirig'i", ru: "Задание урока", en: "Lesson assignment" })} value={l.assignment} />}
              {l.assignmentFileUrl && (
                <a href={l.assignmentFileUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400 ${l.assignment ? "mt-2" : ""}`}>
                  <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Topshiriq faylini ochish", ru: "Открыть файл задания", en: "Open assignment file" })}
                </a>
              )}
            </div>
          )}
          {(l.homework || l.homeworkFileUrl) && (
            <div>
              {l.homework && <Field label={tr(locale, { uz: "Uy vazifasi", ru: "Домашнее задание", en: "Homework" })} value={l.homework} />}
              {l.homeworkFileUrl && (
                <a href={l.homeworkFileUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 ${l.homework ? "mt-2" : ""}`}>
                  <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Uy vazifasi faylini ochish", ru: "Открыть файл домашнего задания", en: "Open homework file" })}
                </a>
              )}
            </div>
          )}
          {l.materialUrl && (
            <a href={l.materialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-brand-950/30">
              <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Materialni ochish", ru: "Открыть материал", en: "Open material" })}
            </a>
          )}
        </div>
      )}
    </li>
  );
}

// Dars belgisi (video/topshiriq/uy vazifa/material)
function Tag({ emoji, text, tone }: { emoji: string; text: string; tone: "rose" | "amber" | "emerald" | "blue" }) {
  const c = {
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold", c)}><span>{emoji}</span> {text}</span>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

/* ── Qo'shish / tahrirlash drawer ── */
function LessonDrawer({ programId, initial, locale, onClose }: { programId: string; initial: VLesson | null; locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [levelCode, setLevelCode] = useState(initial?.levelCode ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [assignment, setAssignment] = useState(initial?.assignment ?? "");
  const [assignmentFileUrl, setAssignmentFileUrl] = useState(initial?.assignmentFileUrl ?? "");
  const [homework, setHomework] = useState(initial?.homework ?? "");
  const [homeworkFileUrl, setHomeworkFileUrl] = useState(initial?.homeworkFileUrl ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [materialUrl, setMaterialUrl] = useState(initial?.materialUrl ?? "");
  const [saving, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    if (!title.trim()) { setErr("title"); return; }
    // Bo'sh qolgan muhim maydonlar haqida eslatma (baribir saqlash mumkin)
    const missing: string[] = [];
    if (!topic.trim()) missing.push(tr(locale, { uz: "Mavzu", ru: "Тема", en: "Topic" }));
    if (!videoUrl) missing.push(tr(locale, { uz: "Dars videosi", ru: "Видео урока", en: "Lesson video" }));
    if (!assignment.trim() && !assignmentFileUrl) missing.push(tr(locale, { uz: "Dars topshirig'i", ru: "Задание урока", en: "Assignment" }));
    if (!homework.trim() && !homeworkFileUrl) missing.push(tr(locale, { uz: "Uy vazifasi", ru: "Домашнее задание", en: "Homework" }));
    if (missing.length > 0) {
      const msg = tr(locale, {
        uz: `Quyidagilar to'ldirilmagan:\n\n• ${missing.join("\n• ")}\n\nBaribir saqlaysizmi?`,
        ru: `Не заполнено:\n\n• ${missing.join("\n• ")}\n\nВсё равно сохранить?`,
        en: `Not filled in:\n\n• ${missing.join("\n• ")}\n\nSave anyway?`,
      });
      if (!confirm(msg)) return;
    }
    const input: LessonInput = { title, levelCode, topic, assignment, assignmentFileUrl, homework, homeworkFileUrl, videoUrl, materialUrl };
    start(async () => {
      const r = initial ? await updateCourseLesson(initial.id, input) : await createCourseLesson(programId, input);
      if (r.ok) { router.refresh(); onClose(); } else setErr(r.error ?? "error");
    });
  };

  const inp = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";
  const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[480px] max-w-[94%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{initial ? tr(locale, { uz: "Darsni tahrirlash", ru: "Редактировать урок", en: "Edit lesson" }) : tr(locale, { uz: "Yangi dars", ru: "Новый урок", en: "New lesson" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className={lbl}>{tr(locale, { uz: "Dars nomi", ru: "Название урока", en: "Lesson title" })} <span className="text-rose-500">*</span></label>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setErr(null); }} placeholder={tr(locale, { uz: "1-dars: Kirish", ru: "Урок 1: Введение", en: "Lesson 1: Intro" })} className={cn(inp, err === "title" && "border-rose-400")} />
          </div>
          <div>
            <label className={lbl}>{tr(locale, { uz: "Mavzu (tafsilot)", ru: "Тема (описание)", en: "Topic (details)" })}</label>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} className={inp} />
          </div>
          {/* Daraja — o'quvchi portalida darslar shu bo'yicha bo'limlarga ajraladi */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level" })}
              <span className="ml-1 font-normal text-slate-400">({tr(locale, { uz: "o'quvchi ilovasida bo'limlarga ajratish uchun", ru: "для разделов в приложении ученика", en: "groups lessons in the student app" })})</span>
            </label>
            <select value={levelCode} onChange={(e) => setLevelCode(e.target.value)} className={inp}>
              <option value="">{tr(locale, { uz: "— tanlanmagan —", ru: "— не выбрано —", en: "— none —" })}</option>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <FileUpload
            label={tr(locale, { uz: "Dars videosi", ru: "Видео урока", en: "Lesson video" })}
            accept="video/*" current={videoUrl} onChange={setVideoUrl} locale={locale} isVideo
          />

          <div>
            <label className={lbl}>{tr(locale, { uz: "Dars topshirig'i", ru: "Задание урока", en: "Lesson assignment" })}</label>
            <textarea value={assignment} onChange={(e) => setAssignment(e.target.value)} rows={2} placeholder={tr(locale, { uz: "Darsda bajariladigan topshiriq", ru: "Задание на уроке", en: "In-class assignment" })} className={inp} />
          </div>

          <FileUpload
            label={tr(locale, { uz: "Topshiriq fayli (pdf/word/txt)", ru: "Файл задания (pdf/word/txt)", en: "Assignment file (pdf/word/txt)" })}
            accept="application/pdf,.doc,.docx,.txt,.rtf,image/*,.xls,.xlsx,.ppt,.pptx,.zip" current={assignmentFileUrl} onChange={setAssignmentFileUrl} locale={locale}
          />

          <div>
            <label className={lbl}>{tr(locale, { uz: "Uy vazifasi", ru: "Домашнее задание", en: "Homework" })}</label>
            <textarea value={homework} onChange={(e) => setHomework(e.target.value)} rows={2} placeholder={tr(locale, { uz: "Uyga beriladigan vazifa", ru: "Домашнее задание", en: "Homework" })} className={inp} />
          </div>

          <FileUpload
            label={tr(locale, { uz: "Uy vazifasi fayli (pdf/rasm/hujjat)", ru: "Файл домашнего задания (pdf/изобр./документ)", en: "Homework file (pdf/image/doc)" })}
            accept="application/pdf,image/*,video/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" current={homeworkFileUrl} onChange={setHomeworkFileUrl} locale={locale}
          />

          <FileUpload
            label={tr(locale, { uz: "Qo'shimcha material (fayl/pdf)", ru: "Доп. материал (файл/pdf)", en: "Extra material (file/pdf)" })}
            accept="application/pdf,image/*,video/*" current={materialUrl} onChange={setMaterialUrl} locale={locale}
          />

          {err && err !== "title" && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{err === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission." }) : tr(locale, { uz: "Xatolik yuz berdi.", ru: "Произошла ошибка.", en: "An error occurred." })}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel" })}</button>
          <button type="button" onClick={save} disabled={saving} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
        </div>
      </div>
    </div>, document.body);
}

/* ── Fayl yuklash vidjeti (video/material) ── */
function FileUpload({ label, accept, current, onChange, locale, isVideo }: { label: string; accept: string; current: string; onChange: (url: string) => void; locale: Locale; isVideo?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null); setUploading(true); setPct(0);
    // XHR bilan progress
    const url = await new Promise<{ url?: string; error?: string }>((resolve) => {
      const fd = new FormData(); fd.set("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setPct(Math.round((ev.loaded / ev.total) * 100)); };
      xhr.onload = () => { try { const j = JSON.parse(xhr.responseText); resolve(xhr.status < 300 ? { url: j.url } : { error: j.error }); } catch { resolve({ error: "upload_failed" }); } };
      xhr.onerror = () => resolve({ error: "upload_failed" });
      xhr.send(fd);
    });
    setUploading(false);
    if (url.url) onChange(url.url);
    else setError(url.error === "too_large" ? tr(locale, { uz: "Fayl juda katta (maks 300 MB)", ru: "Файл слишком большой (макс 300 МБ)", en: "File too large (max 300 MB)" }) : tr(locale, { uz: "Yuklab bo'lmadi", ru: "Не удалось загрузить", en: "Upload failed" }));
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      {current && !uploading ? (
        <div className="space-y-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          {isVideo ? (
            <video controls preload="metadata" className="max-h-[220px] w-full rounded-md bg-black" src={current} />
          ) : (
            <a href={current} target="_blank" rel="noreferrer" className="block truncate text-sm text-brand-600 hover:underline">{current.split("/").pop()}</a>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.click()} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{tr(locale, { uz: "Almashtirish", ru: "Заменить", en: "Replace" })}</button>
            <button type="button" onClick={() => onChange("")} className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900">{tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Remove" })}</button>
          </div>
        </div>
      ) : uploading ? (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500"><span>{tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Uploading..." })}</span><span className="font-semibold tabular-nums">{pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-4 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400">
          <Icon name="download" className="h-4 w-4 rotate-180" /> {tr(locale, { uz: "Fayl tanlash", ru: "Выбрать файл", en: "Choose file" })}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={onPick} />
    </div>
  );
}
