"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createStudentInGroup, createLesson, enrollStudent, removeStudent, bulkAddStudents, type FormState } from "../actions";
import { updateGroup } from "./actions";
import { GROUP_FORMATS, GROUP_FORMAT_LABELS } from "@/lib/constants";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { fmtUzPhoneInput } from "@/lib/phone";
import { Icon } from "../../_components/Icon";
import { GROUP_COLORS } from "../NewGroupForm";

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const btn = "rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60";

const weekdayList = (locale: Locale): { v: number; label: string }[] => [
  { v: 1, label: tr(locale, { uz: "Du", ru: "Пн", en: "Mo" }) },
  { v: 2, label: tr(locale, { uz: "Se", ru: "Вт", en: "Tu" }) },
  { v: 3, label: tr(locale, { uz: "Ch", ru: "Ср", en: "We" }) },
  { v: 4, label: tr(locale, { uz: "Pa", ru: "Чт", en: "Th" }) },
  { v: 5, label: tr(locale, { uz: "Ju", ru: "Пт", en: "Fr" }) },
  { v: 6, label: tr(locale, { uz: "Sh", ru: "Сб", en: "Sa" }) },
  { v: 7, label: tr(locale, { uz: "Ya", ru: "Вс", en: "Su" }) },
];

const statusOptions = (locale: Locale): { v: string; label: string }[] => [
  { v: "PLANNED", label: tr(locale, { uz: "Rejalashtirilgan", ru: "Запланирован", en: "Planned" }) },
  { v: "ACTIVE", label: tr(locale, { uz: "Faol", ru: "Активен", en: "Active" }) },
  { v: "FINISHED", label: tr(locale, { uz: "Yakunlangan", ru: "Завершён", en: "Finished" }) },
  { v: "CANCELLED", label: tr(locale, { uz: "Bekor qilingan", ru: "Отменён", en: "Cancelled" }) },
];

export type EditGroupData = {
  id: string;
  name: string;
  programId: string;
  teacherId: string | null;
  levelCode: string | null;
  color: string | null;
  format: string;
  onlineLink: string | null;
  room: string | null;
  status: string;
  capacity: number;
  startDate: string | null; // "yyyy-mm-dd"
  endDate: string | null; // "yyyy-mm-dd"
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null; // izoh/kament
  monthlyFee: number | null; // guruh oylik to'lovi (bo'sh — kurs narxi)
};

export function CreateStudentForm({ groupId, locale }: { groupId: string; locale: Locale }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createStudentInGroup, {});
  const ref = useRef<HTMLFormElement>(null);
  const [phone, setPhone] = useState("");
  // +998 doimiy prefiks; foydalanuvchi faqat qolgan 9 raqamni kiritadi (src/lib/phone.ts)
  const fmtPhone = fmtUzPhoneInput;
  // Har muvaffaqiyatli qo'shishda tozalanadi (state — har safar yangi obyekt, shu sabab ketma-ket qo'shishda ham ishlaydi)
  useEffect(() => { if (state.ok) { ref.current?.reset(); setPhone(""); } }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Yangi o'quvchi F.I.Sh.", ru: "Ф.И.О. нового ученика", en: "New student full name" })}</label>
        <input name="fullName" required placeholder={tr(locale, { uz: "Ism Familiya", ru: "Имя Фамилия", en: "First Last" })} className={input} />
      </div>
      <div className="min-w-[140px]">
        <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" })}</label>
        <div className="flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
          <span className="select-none font-medium text-slate-500">+998</span>
          <input value={phone} onChange={(e) => setPhone(fmtPhone(e.target.value))} inputMode="numeric" placeholder="90 123 45 67" className="ml-2 w-full flex-1 bg-transparent outline-none" />
        </div>
        <input type="hidden" name="phone" value={phone ? "+998 " + phone : ""} />
      </div>
      <button type="submit" disabled={pending} className={btn}>{pending ? "..." : tr(locale, { uz: "+ Qo'shish", ru: "+ Добавить", en: "+ Add" })}</button>
      {state.error && (
        <span className="w-full text-xs text-red-600">
          {state.error === "phone_exists"
            ? tr(locale, { uz: "Bu telefon raqamli o'quvchi allaqachon mavjud — \"Mavjud o'quvchini biriktirish\" dan foydalaning.", ru: "Ученик с этим номером уже существует — используйте «Привязать существующего».", en: "A student with this phone already exists — use \"Enroll existing\"." })
            : tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" })}
        </span>
      )}
    </form>
  );
}

export function EnrollExisting({ groupId, candidates, locale }: { groupId: string; candidates: { id: string; fullName: string }[]; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [sel, setSel] = useState("");

  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[180px]">
        <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Mavjud o'quvchini biriktirish", ru: "Прикрепить существующего ученика", en: "Enroll existing student" })}</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className={input}>
          <option value="">—</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
      </div>
      <button
        disabled={pending || !sel}
        onClick={() => start(async () => { await enrollStudent(groupId, sel); setSel(""); router.refresh(); })}
        className={btn}
      >
        {pending ? "..." : tr(locale, { uz: "Biriktirish", ru: "Прикрепить", en: "Enroll" })}
      </button>
    </div>
  );
}

// Excel'dan nusxa-joylab yoki CSV/xlsx'dan o'quvchilarni ajratib oladi
const HEADER_RE = /^(ism|name|f\.?\s?i\.?\s?sh|fio|ismi|talaba|o'?quvchi|student|№|no|nomi|telefon|phone)$/i;
function parseStudentRows(text: string): { name: string; phone: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[\t;,]/).map((x) => x.trim()).filter(Boolean))
    .filter((parts) => parts.length > 0 && parts[0].length >= 2 && !HEADER_RE.test(parts[0]))
    .map((parts) => {
      const name = parts[0];
      const phone = parts.slice(1).find((p) => p.replace(/\D/g, "").length >= 5) ?? parts[1] ?? "";
      return { name, phone };
    });
}

export function BulkImportStudents({ groupId, locale }: { groupId: string; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const rows = useMemo(() => parseStudentRows(text), [text]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      try {
        const XLSX = await import("xlsx");
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const arr = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
        const lines = arr
          .map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "").trim()).filter(Boolean) : []))
          .filter((row) => row.length > 0)
          .map((row) => row.join(","));
        setText(lines.join("\n"));
        setMsg(null);
      } catch {
        setMsg(tr(locale, { uz: "Excel faylni o'qib bo'lmadi", ru: "Не удалось прочитать Excel", en: "Could not read Excel file" }));
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result || ""));
      reader.readAsText(f);
    }
  };

  const doImport = () => {
    if (!rows.length) return;
    setMsg(null);
    start(async () => {
      const r = await bulkAddStudents(groupId, rows.map((x) => ({ name: x.name, phone: x.phone || null })));
      if (r.ok) { setMsg(tr(locale, { uz: `${r.added} o'quvchi qo'shildi ✓`, ru: `Добавлено ${r.added} ✓`, en: `${r.added} added ✓` })); setText(""); router.refresh(); }
      else setMsg(tr(locale, { uz: "Xatolik yoki ma'lumot yo'q", ru: "Ошибка или нет данных", en: "Error or no data" }));
    });
  };

  return (
    <div className="rounded-lg border border-slate-200/70 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/40">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5"><Icon name="download" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Excel / CSV orqali ko'p o'quvchi qo'shish", ru: "Добавить учеников через Excel / CSV", en: "Add students via Excel / CSV" })}</span>
        <Icon name="chevronDown" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-slate-400">{tr(locale, { uz: "Excel (.xlsx) yoki CSV fayl yuklang, yoki Excel'dan nusxalab joylang. Har qatorda: Ism Familiya, +998... (1-ustun ism, 2-ustun telefon).", ru: "Загрузите Excel (.xlsx) или CSV, либо вставьте из Excel. По строке: Имя Фамилия, +998...", en: "Upload Excel (.xlsx) or CSV, or paste from Excel. Per line: Name, +998..." })}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={"Ism Familiya, +998901234567\nAli Valiyev, +998907654321"} className={`${input} font-mono text-xs`} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Icon name="uploadCloud" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Excel / CSV fayl", ru: "Excel / CSV файл", en: "Excel / CSV file" })}
              <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={onFile} />
            </label>
            <span className="text-xs text-slate-400">{rows.length} {tr(locale, { uz: "ta topildi", ru: "найдено", en: "found" })}</span>
            <button type="button" onClick={doImport} disabled={pending || !rows.length} className="ml-auto rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {pending ? "..." : tr(locale, { uz: "Import qilish", ru: "Импортировать", en: "Import" })}
            </button>
          </div>
          {msg && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{msg}</p>}
        </div>
      )}
    </div>
  );
}

export function RemoveStudentButton({ groupId, studentId, locale }: { groupId: string; studentId: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      title={tr(locale, { uz: "Guruhdan olib tashlash", ru: "Убрать из группы", en: "Remove from group" })}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(tr(locale, { uz: "O'quvchini guruhdan olib tashlaysizmi?", ru: "Убрать ученика из группы?", en: "Remove the student from the group?" }))) return;
        start(async () => { await removeStudent(groupId, studentId); router.refresh(); });
      }}
      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "..." : tr(locale, { uz: "Olib tashlash", ru: "Убрать", en: "Remove" })}
    </button>
  );
}

export function NewLessonForm({ groupId, locale }: { groupId: string; locale: Locale }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createLesson, {});
  const ref = useRef<HTMLFormElement>(null);
  // Har muvaffaqiyatli qo'shishda tozalanadi (ketma-ket qo'shish uchun)
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Dars mavzusi", ru: "Тема урока", en: "Lesson topic" })}</label>
        <input name="topic" placeholder={tr(locale, { uz: "Perfekt — 2-dars", ru: "Перфект — урок 2", en: "Perfect — lesson 2" })} className={input} />
      </div>
      <div className="min-w-[180px]">
        <label className="mb-1 block text-xs font-medium text-slate-600">{tr(locale, { uz: "Boshlanish vaqti", ru: "Время начала", en: "Start time" })}</label>
        <input name="startsAt" type="datetime-local" required className={input} />
      </div>
      <button type="submit" disabled={pending} className={btn}>{pending ? "..." : tr(locale, { uz: "+ Dars", ru: "+ Урок", en: "+ Lesson" })}</button>
      {state.error && <span className="text-xs text-red-600">{tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" })}</span>}
    </form>
  );
}

export function EditGroupButton({
  group,
  programs,
  teachers,
  locale,
  compact,
}: {
  group: EditGroupData;
  programs: { id: string; name: string }[];
  teachers: { id: string; fullName: string }[];
  locale: Locale;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" })}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
        >
          <Icon name="pencil" className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" })}
        </button>
      )}
      {open && (
        <EditGroupForm group={group} programs={programs} teachers={teachers} locale={locale} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function EditGroupForm({
  group,
  programs,
  teachers,
  locale,
  onClose,
}: {
  group: EditGroupData;
  programs: { id: string; name: string }[];
  teachers: { id: string; fullName: string }[];
  locale: Locale;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateGroup, {});
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const [format, setFormat] = useState<string>(group.format);
  const [color, setColor] = useState<string>(group.color ?? GROUP_COLORS[0]);
  const [days, setDays] = useState<number[]>(
    (group.weekdays ?? "").split(",").map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7)
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!mounted) return null;

  const fLabel = "mb-1 block text-xs font-medium text-slate-600";
  const toggleDay = (v: number) => setDays((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        action={action}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop"
      >
        <input type="hidden" name="groupId" value={group.id} />

        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">{tr(locale, { uz: "Guruhni tahrirlash", ru: "Редактировать группу", en: "Edit group" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={fLabel}>{tr(locale, { uz: "Nomi", ru: "Название", en: "Name" })} <span className="text-rose-500">*</span></label>
            <input name="name" required defaultValue={group.name} className={input} />
          </div>
          <div>
            <label className={fLabel}>{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })} <span className="text-rose-500">*</span></label>
            <select name="programId" required defaultValue={group.programId} className={input}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={fLabel}>{tr(locale, { uz: "Rang", ru: "Цвет", en: "Color" })}</label>
            <div className="flex flex-wrap items-center gap-2">
              {GROUP_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                  className={`h-7 w-7 rounded-full transition ${color === c ? "ring-2 ring-slate-500 ring-offset-2" : "hover:scale-110"}`}
                  style={{ background: c }} />
              ))}
              <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-white/80" style={{ background: color }} title={tr(locale, { uz: "Boshqa rang", ru: "Другой цвет", en: "Custom color" })}>
                <span className="text-[11px] font-bold">+</span>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
              <span className="text-xs uppercase text-slate-400">{color}</span>
            </div>
            <input type="hidden" name="color" value={color} />
          </div>
          <div>
            <label className={fLabel}>{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}</label>
            <select name="teacherId" defaultValue={group.teacherId ?? ""} className={`${input} truncate`}>
              <option value="">—</option>
              {teachers.map((tt) => <option key={tt.id} value={tt.id}>{tt.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className={fLabel}>{tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level" })}</label>
            <input name="levelCode" defaultValue={group.levelCode ?? ""} placeholder="A1.2" className={input} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fLabel}>{tr(locale, { uz: "O'quv shakli", ru: "Форма обучения", en: "Format" })}</label>
              <select name="format" value={format} onChange={(e) => setFormat(e.target.value)} className={input}>
                {GROUP_FORMATS.map((f) => <option key={f} value={f}>{GROUP_FORMAT_LABELS[f][locale]}</option>)}
              </select>
            </div>
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Holat", ru: "Статус", en: "Status" })}</label>
              <select name="status" defaultValue={group.status} className={input}>
                {statusOptions(locale).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {(format === "ONLINE" || format === "HYBRID") && (
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Onlayn havola", ru: "Онлайн-ссылка", en: "Online link" })}</label>
              <input name="onlineLink" type="url" defaultValue={group.onlineLink ?? ""} placeholder="https://zoom.us/j/..." className={input} />
            </div>
          )}

          <div>
            <label className={fLabel}>{tr(locale, { uz: "Kunlar", ru: "Дни", en: "Days" })}</label>
            <div className="flex flex-wrap gap-1.5">
              {weekdayList(locale).map((d) => {
                const active = days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
                    className={`h-9 w-11 rounded-lg border text-sm font-semibold transition ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="weekdays" value={days.join(",")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Boshlanish vaqti", ru: "Время начала", en: "Start time" })}</label>
              <input name="startTime" type="time" defaultValue={group.startTime ?? ""} className={input} />
            </div>
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Tugash vaqti", ru: "Время окончания", en: "End time" })}</label>
              <input name="endTime" type="time" defaultValue={group.endTime ?? ""} className={input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room" })}</label>
              <input name="room" defaultValue={group.room ?? ""} placeholder={tr(locale, { uz: "204-xona", ru: "Кабинет 204", en: "Room 204" })} className={input} />
            </div>
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Sig'im", ru: "Вместимость", en: "Capacity" })}</label>
              <input name="capacity" type="number" min="1" max="100" defaultValue={group.capacity} className={input} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Boshlanish sanasi", ru: "Дата начала", en: "Start date" })}</label>
              <input name="startDate" type="date" defaultValue={group.startDate ?? ""} className={input} />
            </div>
            <div>
              <label className={fLabel}>{tr(locale, { uz: "Tugash sanasi", ru: "Дата окончания", en: "End date" })}</label>
              <input name="endDate" type="date" defaultValue={group.endDate ?? ""} className={input} />
            </div>
          </div>

          {/* Oylik to'lov — bo'sh qoldirilsa kurs narxi ishlatiladi */}
          <div>
            <label className={fLabel}>{tr(locale, { uz: "Oylik to'lov (so'm)", ru: "Ежемесячная оплата (сум)", en: "Monthly fee (UZS)" })}</label>
            <input name="monthlyFee" type="number" min="0" step="10000" defaultValue={group.monthlyFee ?? ""} placeholder={tr(locale, { uz: "kurs narxi", ru: "цена курса", en: "course price" })} className={input} />
            <p className="mt-1 text-[11px] text-slate-400">
              {tr(locale, {
                uz: "O'quvchi qo'shilgan oydan boshlab har oy qarzga hisoblanadi.",
                ru: "Начисляется в долг каждый месяц с месяца зачисления ученика.",
                en: "Charged monthly from the student's join month.",
              })}
            </p>
          </div>

          {/* Izoh — guruh ma'lumoti ko'rinadigan hamma joyda chiqadi */}
          <div>
            <label className={fLabel}>{tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment" })}</label>
            <textarea
              name="note"
              rows={3}
              maxLength={1000}
              defaultValue={group.note ?? ""}
              placeholder={tr(locale, {
                uz: "Guruh haqida qo'shimcha ma'lumot",
                ru: "Дополнительная информация о группе",
                en: "Additional info about the group",
              })}
              className={`${input} h-auto resize-y py-2 leading-relaxed`}
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              {state.error === "room_conflict"
                ? tr(locale, { uz: "Bu xona shu kun va vaqtda band: ", ru: "Этот кабинет занят в это время: ", en: "This room is busy at this time: " }) + (state.detail ?? "")
                : state.error === "forbidden"
                  ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission." })
                  : tr(locale, { uz: "Ma'lumotlar to'liq emas.", ru: "Данные заполнены не полностью.", en: "Data is incomplete." })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}
          </button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
