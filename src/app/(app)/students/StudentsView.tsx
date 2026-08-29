"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDoubleClickOpen } from "../_components/useDoubleClickOpen";
import { cn } from "@/lib/cn";
import { EDU_STATUS_LABELS, EDU_STATUSES, PAYMENT_STATUS_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, label, formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { isReceiptRequired, type ReceiptMode } from "@/lib/receiptMode";
import { quickCreateStudent, type QuickState } from "../actions";
import { updateStudent, bulkArchiveStudents, bulkAssignGroup, bulkNotifyStudents, setStudentImage, getStudentPayments, acceptPayment, archiveStudent, restoreStudent, deleteStudentPermanently, studentBranchOptions, moveStudentToBranch, addStudentDebt, updatePaymentRecord, deletePaymentRecord, type StudentPayments, type MonthPay, type PayRow, type ReceiptData } from "./actions";
import { Icon } from "../_components/Icon";
import BranchMover from "../_components/BranchMover";

// Sahifaga serverdan keladigan bitta o'quvchi qatori
export interface VStudent {
  id: string;
  fullName: string;
  phone: string | null;
  imageUrl: string | null;
  eduStatus: string;
  currentLevel: string | null;
  groups: { id: string; name: string }[];
  teachers: string[];
  courses: string[];
  scheduleDates: string[]; // ISO
  balance: number;
  debt: number; // jami qarzdorlik — PENDING to'lovlar yig'indisi
  paidThisMonth: boolean; // shu oy kamida bitta PAID to'lov bo'lganmi
  note: string | null;
  branchName: string | null;
}

interface Props {
  students: VStudent[];
  courses: string[];
  locale: Locale;
  canCreate: boolean;
  canPay: boolean;
  currentUserName: string;
  /** CEO sozlamasi: chek yuklash majburiymi (server'dan keladi) */
  receiptMode: ReceiptMode;
}

const PAGE_SIZE = 15;

// "Ustunlar" menyusidan yashirilishi mumkin bo'lgan ustunlar
const OPTIONAL_COLS = [
  { key: "telefon", label: { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" } },
  { key: "guruhlar", label: { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" } },
  { key: "oqituvchilar", label: { uz: "O'qituvchilar", ru: "Преподаватели", en: "Teachers", de: "Lehrer" } },
  { key: "sanalar", label: { uz: "Mashg'ulotlar sanalari", ru: "Даты занятий", en: "Lesson dates", de: "Unterrichtstermine" } },
  { key: "balans", label: { uz: "Balans", ru: "Баланс", en: "Balance", de: "Saldo" } },
  { key: "izoh", label: { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" } },
] as const;

const statusTone: Record<string, string> = {
  ACTIVE: "#16a34a",
  WAITING: "#d97706",
  FROZEN: "#64748b",
  TRANSFERRED: "#0891b2",
  LEVEL_DONE: "#7c3aed",
  PROGRAM_DONE: "#7c3aed",
  EXPELLED: "#dc2626",
  CERTIFIED: "#4148ef",
  ARCHIVED: "#64748b",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
// Ism uchun barqaror rang (avatar foni)
function hue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

// FOTO: o'quvchi rasmi bo'lsa rasm, bo'lmasa avatar (initsial). Rahbariyat bosib rasm yuklaydi.
function StudentAvatar({ id, name, imageUrl, canManage, locale }: { id: string; name: string; imageUrl: string | null; canManage: boolean; locale: Locale }) {
  const h = hue(name);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 200, scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), hh = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = hh;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, hh);
        const url = c.toDataURL("image/jpeg", 0.82);
        startUpload(async () => { const r = await setStudentImage(id, url); if (r.ok) router.refresh(); });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="group/av relative h-8 w-8">
      {imageUrl ? (
        <span className="block h-8 w-8 rounded-full bg-cover bg-center ring-1 ring-black/5 dark:ring-white/10" style={{ backgroundImage: `url(${imageUrl})` }} />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: `hsl(${h} 55% 42%)`, background: `hsl(${h} 70% 92%)` }}><Icon name="user" className="h-4 w-4" /></span>
      )}
      {canManage && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title={imageUrl ? tr(locale, { uz: "Rasmni almashtirish", ru: "Заменить фото", en: "Change photo", de: "Foto ändern" }) : tr(locale, { uz: "Rasm yuklash", ru: "Загрузить фото", en: "Upload photo", de: "Foto hochladen" })}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition group-hover/av:opacity-100 disabled:opacity-100"
          >
            {uploading ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="camera" className="h-4 w-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </>
      )}
    </div>
  );
}

export default function StudentsView({ students, courses, locale, canCreate, canPay, currentUserName, receiptMode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Filtrlar ──
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");
  const [fin, setFin] = useState("");
  const [groupCount, setGroupCount] = useState("");

  // ── Saralash / sahifa / belgilash ──
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Ustunlar ko'rinishi ──
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [colMenu, setColMenu] = useState(false);
  const isVisible = (key: string) => !hidden.has(key);

  // ── Modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<VStudent | null>(null);
  const [detail, setDetail] = useState<VStudent | null>(null);
  // 1 marta bosish -> tezkor oyna, 2 marta -> to'liq profil
  const { single, double } = useDoubleClickOpen();

  // Global qidiruvdan kelinganda (/students?student=<id>) o'sha talaba kartasi
  // darhol ochiladi. useSearchParams — sahifa qayta yuklanmasa ham (yumshoq
  // o'tish) manzil o'zgarishini eshitadi; parametr karta yopilganda tozalanadi.
  const openId = searchParams.get("student");
  useEffect(() => {
    if (!openId) return;
    const found = students.find((x) => x.id === openId);
    if (found) setDetail(found);
  }, [openId, students]);

  const closeDetail = () => {
    setDetail(null);
    if (openId) router.replace("/students");
  };

  // ── Ommaviy amallar ──
  const [bulkModal, setBulkModal] = useState<null | "assign" | "message">(null);
  const [bulkBusy, startBulk] = useTransition();

  const allGroups = useMemo(() => {
    const m = new Map<string, string>();
    for (const st of students) for (const g of st.groups) m.set(g.id, g.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const runBulk = (fn: () => Promise<{ ok?: boolean; count?: number; error?: string }>) => {
    startBulk(async () => { const r = await fn(); if (r.ok) { setSelected(new Set()); setBulkModal(null); router.refresh(); } });
  };
  const handleArchive = () => {
    if (selected.size === 0) return;
    if (!window.confirm(tr(locale, { uz: `${selected.size} ta o'quvchini arxivlaysizmi?`, ru: `Архивировать ${selected.size} ученик(ов)?`, en: `Archive ${selected.size} student(s)?`, de: `${selected.size} Schüler archivieren?` }))) return;
    runBulk(() => bulkArchiveStudents([...selected]));
  };

  const activeFilters = [q, course, status, fin, groupCount].filter(Boolean).length;

  // Filtrlash + saralash
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = students.filter((st) => {
      if (needle && !st.fullName.toLowerCase().includes(needle) && !(st.phone ?? "").toLowerCase().includes(needle))
        return false;
      if (course && !st.courses.includes(course)) return false;
      if (status && st.eduStatus !== status) return false;
      if (fin === "paid" && st.balance <= 0) return false;
      if (fin === "unpaid" && st.balance > 0) return false;
      if (fin === "debtor_month" && st.paidThisMonth) return false; // bu oy to'lamagan
      if (fin === "debtor_total" && st.debt <= 0) return false; // umumiy qarzi bor
      if (groupCount === "0" && st.groups.length !== 0) return false;
      if (groupCount === "1" && st.groups.length !== 1) return false;
      if (groupCount === "2" && st.groups.length < 2) return false;
      return true;
    });
    list.sort((a, b) =>
      sortDir === "asc" ? a.fullName.localeCompare(b.fullName) : b.fullName.localeCompare(a.fullName)
    );
    return list;
  }, [students, q, course, status, fin, groupCount, sortDir]);

  // Filtr o'zgarsa 1-sahifaga qaytamiz
  useEffect(() => setPage(1), [q, course, status, fin, groupCount]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const resetFilters = () => { setQ(""); setCourse(""); setStatus(""); setFin(""); setGroupCount(""); };

  // CSV eksport (joriy filtrlangan ro'yxat)
  const exportCsv = () => {
    const head = [
      tr(locale, { uz: "Ism", ru: "Имя", en: "Name", de: "Name" }),
      tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }),
      tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" }),
      tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" }),
      tr(locale, { uz: "O'qituvchilar", ru: "Преподаватели", en: "Teachers", de: "Lehrer" }),
      tr(locale, { uz: "Balans", ru: "Баланс", en: "Balance", de: "Saldo" }),
    ];
    const lines = filtered.map((s) =>
      [
        s.fullName,
        s.phone ?? "",
        label(EDU_STATUS_LABELS, s.eduStatus, locale),
        s.groups.map((g) => g.name).join(" | "),
        s.teachers.join(" | "),
        String(s.balance),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "﻿" + [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "talabalar.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const colCount = 2 /* checkbox + Foto */ + 1 /* Ism */ + OPTIONAL_COLS.filter((c) => isVisible(c.key)).length + 1 /* amallar */;

  return (
    <div>
      {/* Sarlavha */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Talabalar", ru: "Ученики", en: "Students", de: "Schüler" })}</h1>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[.98]"
          >
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangisini qo'shish", ru: "Добавить нового", en: "Add new", de: "Neu hinzufügen" })}
          </button>
        )}
      </div>

      {/* Filtrlar paneli */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr(locale, { uz: "Ism yoki telefon orqali qidir", ru: "Поиск по имени или телефону", en: "Search by name or phone", de: "Nach Name oder Telefon suchen" })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-900"
            />
          </div>

          <Select value={course} onChange={setCourse} placeholder={tr(locale, { uz: "Kurslar", ru: "Курсы", en: "Courses", de: "Kurse" })}>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>

          <Select value={status} onChange={setStatus} placeholder={tr(locale, { uz: "Talaba holati", ru: "Статус ученика", en: "Student status", de: "Schülerstatus" })}>
            {EDU_STATUSES.map((st) => (
              <option key={st} value={st}>{label(EDU_STATUS_LABELS, st, locale)}</option>
            ))}
          </Select>

          <Select value={fin} onChange={setFin} placeholder={tr(locale, { uz: "Moliyaviy holati", ru: "Финансовый статус", en: "Financial status", de: "Finanzstatus" })}>
            <option value="paid">{tr(locale, { uz: "To'lagan (balans musbat)", ru: "Оплатил (баланс положительный)", en: "Paid (positive balance)", de: "Bezahlt (positiver Saldo)" })}</option>
            <option value="unpaid">{tr(locale, { uz: "To'lamagan (balans nol)", ru: "Не оплатил (баланс ноль)", en: "Unpaid (zero balance)", de: "Unbezahlt (Saldo null)" })}</option>
            <option value="debtor_month">{tr(locale, { uz: "Bu oydagi qarzdorlar", ru: "Должники этого месяца", en: "This month's debtors", de: "Schuldner diesen Monats" })}</option>
            <option value="debtor_total">{tr(locale, { uz: "Umumiy qarzdor o'quvchilar", ru: "Общие должники", en: "Total debtor students", de: "Schüler mit Gesamtschulden" })}</option>
          </Select>

          <SelectDisabled locale={locale} placeholder={tr(locale, { uz: "Teglar bo'yicha", ru: "По тегам", en: "By tags", de: "Nach Tags" })} />
          <InputDisabled locale={locale} placeholder={tr(locale, { uz: "Qo'shimcha ID", ru: "Дополнительный ID", en: "Additional ID", de: "Zusätzliche ID" })} />

          <Select value={groupCount} onChange={setGroupCount} placeholder={tr(locale, { uz: "Guruhlar soni", ru: "Количество групп", en: "Number of groups", de: "Anzahl der Gruppen" })}>
            <option value="0">{tr(locale, { uz: "Guruhsiz", ru: "Без группы", en: "No group", de: "Ohne Gruppe" })}</option>
            <option value="1">{tr(locale, { uz: "1 ta guruh", ru: "1 группа", en: "1 group", de: "1 Gruppe" })}</option>
            <option value="2">{tr(locale, { uz: "2+ guruh", ru: "2+ группы", en: "2+ groups", de: "2+ Gruppen" })}</option>
          </Select>

          <InputDisabled locale={locale} placeholder={tr(locale, { uz: "Boshlanish sana", ru: "Дата начала", en: "Start date", de: "Startdatum" })} icon="calendar" />
          <InputDisabled locale={locale} placeholder={tr(locale, { uz: "Tugash sanasi", ru: "Дата окончания", en: "End date", de: "Enddatum" })} icon="calendar" />
        </div>

        {/* Filtrlar / Ustunlar tugmalari */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name="filter" className="h-4 w-4" /> {tr(locale, { uz: "Filtrlar", ru: "Фильтры", en: "Filters", de: "Filter" })}
            {activeFilters > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setColMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-brand-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <Icon name="settings" className="h-4 w-4" /> {tr(locale, { uz: "Ustunlar", ru: "Столбцы", en: "Columns", de: "Spalten" })}
            </button>
            {colMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setColMenu(false)} />
                <div className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop dark:border-slate-700 dark:bg-slate-800">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{tr(locale, { uz: "Ustunlar", ru: "Столбцы", en: "Columns", de: "Spalten" })}</div>
                  {OPTIONAL_COLS.map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60">
                      <input
                        type="checkbox"
                        checked={isVisible(c.key)}
                        onChange={() =>
                          setHidden((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                      />
                      {tr(locale, c.label)}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
                </th>
                <th className="px-3 py-2.5">{tr(locale, { uz: "Foto", ru: "Фото", en: "Photo", de: "Foto" })}</th>
                <th className="px-4 py-2.5">
                  <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="inline-flex items-center gap-1 transition hover:text-slate-700 dark:hover:text-slate-200">
                    {tr(locale, { uz: "Ism", ru: "Имя", en: "Name", de: "Name" })} <span className="text-brand-500">{sortDir === "asc" ? "↑" : "↓"}</span>
                  </button>
                </th>
                {isVisible("telefon") && <th className="px-4 py-2.5">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</th>}
                {isVisible("guruhlar") && <th className="px-4 py-2.5">{tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}</th>}
                {isVisible("oqituvchilar") && <th className="px-4 py-2.5">{tr(locale, { uz: "O'qituvchilar", ru: "Преподаватели", en: "Teachers", de: "Lehrer" })}</th>}
                {isVisible("sanalar") && <th className="px-4 py-2.5">{tr(locale, { uz: "Mashg'ulotlar sanalari", ru: "Даты занятий", en: "Lesson dates", de: "Unterrichtstermine" })}</th>}
                {isVisible("balans") && <th className="px-4 py-2.5">{tr(locale, { uz: "Balans", ru: "Баланс", en: "Balance", de: "Saldo" })}</th>}
                {isVisible("izoh") && <th className="px-4 py-2.5">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" })}</th>}
                <th className="px-4 py-2.5 text-right">
                  {selected.size > 0 ? (
                    <div className="flex items-center justify-end gap-1">
                      <HeadAction icon="layers" title={tr(locale, { uz: "Guruhga biriktirish", ru: "Привязать к группе", en: "Assign to group", de: "Gruppe zuweisen" })} active onClick={() => setBulkModal("assign")} />
                      <HeadAction icon="mail" title={tr(locale, { uz: "Xabar yuborish", ru: "Отправить сообщение", en: "Send message", de: "Nachricht senden" })} active onClick={() => setBulkModal("message")} />
                      <HeadAction icon="fileX" title={tr(locale, { uz: "Arxivlash", ru: "Архивировать", en: "Archive", de: "Archivieren" })} active onClick={handleArchive} />
                    </div>
                  ) : (
                    tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-16 text-center">
                    <div className="text-3xl opacity-30">📭</div>
                    <div className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "O'quvchi topilmadi", ru: "Ученики не найдены", en: "No students found", de: "Keine Schüler gefunden" })}</div>
                  </td>
                </tr>
              ) : (
                pageRows.map((st) => {
                  const sel = selected.has(st.id);
                  return (
                    <tr
                      key={st.id}
                      // 1 marta bosish -> yonboshdan tezkor ko'rish oynasi (to'lov shu yerda)
                      // 2 marta bosish -> o'quvchining to'liq profil sahifasi
                      // Katakdagi tugmalar e.stopPropagation() bilan himoyalangan.
                      onClick={() => single(() => setDetail(st))}
                      onDoubleClick={() => double(() => router.push(`/students/${st.id}`))}
                      className={cn("cursor-pointer select-none transition hover:bg-slate-50 dark:hover:bg-slate-800/50", sel && "bg-brand-50/60 dark:bg-brand-950/30")}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={() => toggleOne(st.id)} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <StudentAvatar id={st.id} name={st.fullName} imageUrl={st.imageUrl} canManage={canCreate} locale={locale} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="truncate font-medium text-slate-800 dark:text-slate-100">{st.fullName}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{ color: statusTone[st.eduStatus] ?? "#64748b", background: `${statusTone[st.eduStatus] ?? "#64748b"}1a` }}
                          >
                            {label(EDU_STATUS_LABELS, st.eduStatus, locale)}
                          </span>
                          {st.currentLevel && <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{st.currentLevel}</span>}
                        </div>
                      </td>
                      {isVisible("telefon") && (
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-700 dark:text-slate-200">{st.phone ?? "—"}</td>
                      )}
                      {isVisible("guruhlar") && (
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                          {st.groups.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {st.groups.map((g) => (
                                <Link key={g.id} href={`/groups/${g.id}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-950/40">
                                  {g.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </td>
                      )}
                      {isVisible("oqituvchilar") && (
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                          {st.teachers.length ? st.teachers.join(", ") : <span className="text-slate-400">—</span>}
                        </td>
                      )}
                      {isVisible("sanalar") && (
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                          {st.scheduleDates.length ? (
                            <div className="flex flex-wrap gap-1">
                              {st.scheduleDates.map((d, i) => (
                                <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {fmtDate(d)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}
                      {isVisible("balans") && (
                        <td className="px-4 py-2">
                          <span className={cn("font-semibold", st.balance > 0 ? "text-emerald-600" : "text-slate-400")}>
                            {formatMoney(st.balance, locale)}
                          </span>
                        </td>
                      )}
                      {isVisible("izoh") && (
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{st.note ?? "—"}</td>
                      )}
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* To'liq profil sahifasi. Tezkor ko'rish uchun qatorning o'zi bosiladi. */}
                          <Link
                            href={`/students/${st.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                            title={tr(locale, { uz: "To'liq profil", ru: "Полный профиль", en: "Full profile", de: "Vollständiges Profil" })}
                          >
                            <Icon name="expand" className="h-4 w-4" />
                          </Link>
                          {canCreate && (
                            <button
                              onClick={() => setEditing(st)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                              title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}
                            >
                              <Icon name="pencil" className="h-4 w-4" />
                            </button>
                          )}
                          <Link href={st.groups[0] ? `/groups/${st.groups[0].id}` : "/groups"} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" title={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}>
                            <Icon name="layers" className="h-4 w-4" />
                          </Link>
                          {st.phone && (
                            <a href={`tel:${st.phone}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" title={tr(locale, { uz: "Qo'ng'iroq", ru: "Позвонить", en: "Call", de: "Anruf" })}>
                              <Icon name="phone" className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Jadval osti — sahifalash + eksport/import */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-4 py-3 dark:border-slate-800">
          <Pager page={safePage} pageCount={pageCount} onGo={setPage} />
          <div className="flex items-center gap-2">
            <button
              disabled
              title={tr(locale, { uz: "Import (tez orada)", ru: "Импорт (скоро)", en: "Import (coming soon)", de: "Import (bald verfügbar)" })}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600"
            >
              <Icon name="download" className="h-4 w-4 rotate-180" />
            </button>
            <button
              onClick={exportCsv}
              title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300 text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
            >
              <Icon name="download" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 text-xs text-slate-500">
          {tr(locale, { uz: `${selected.size} ta tanlandi`, ru: `Выбрано: ${selected.size}`, en: `${selected.size} selected`, de: `${selected.size} ausgewählt` })} ·{" "}
          <button onClick={() => setSelected(new Set())} className="font-medium text-brand-600 hover:underline">
            {tr(locale, { uz: "bekor qilish", ru: "отмена", en: "cancel", de: "abbrechen" })}
          </button>
        </div>
      )}

      {showCreate && <CreateModal locale={locale} onClose={() => setShowCreate(false)} onDone={() => router.refresh()} />}
      {bulkModal && (
        <BulkModal
          mode={bulkModal}
          count={selected.size}
          groups={allGroups}
          busy={bulkBusy}
          locale={locale}
          onClose={() => setBulkModal(null)}
          onAssign={(gid) => runBulk(() => bulkAssignGroup([...selected], gid))}
          onMessage={(msg) => runBulk(() => bulkNotifyStudents([...selected], msg))}
        />
      )}
      {editing && (
        <EditModal
          student={editing}
          locale={locale}
          onClose={() => setEditing(null)}
          onDone={() => router.refresh()}
        />
      )}
      {detail && (
        <StudentDetailModal
          student={detail}
          locale={locale}
          canManage={canCreate}
          canPay={canPay}
          cashierName={currentUserName}
          receiptMode={receiptMode}
          onClose={closeDetail}
          onEdit={() => { setDetail(null); setEditing(detail); }}
        />
      )}
    </div>
  );
}

// ───────────── O'quvchi ma'lumotlari (bosilганда ochiladi) ─────────────

function StudentDetailModal({
  student: st, locale, canManage, canPay, cashierName, receiptMode, onClose, onEdit,
}: {
  student: VStudent;
  locale: Locale;
  canManage: boolean;
  canPay: boolean;
  cashierName: string;
  receiptMode: ReceiptMode;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pay, setPay] = useState<StudentPayments | null>(null);
  const [, startPay] = useTransition();
  const [payForm, setPayForm] = useState(false);
  const [debtForm, setDebtForm] = useState(false); // qarzdor holatga tushurish formasi
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const h = hue(st.fullName);
  const tone = statusTone[st.eduStatus] ?? "#64748b";

  const reloadPay = () => startPay(async () => { const r = await getStudentPayments(st.id); if (r.ok && r.data) setPay(r.data); });

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // To'lov holati faqat to'lovni ko'ra oladigan xodimlar uchun yuklanadi (masalan Hisobchi — canPay=true, canManage=false)
  useEffect(() => {
    if (!canManage && !canPay) return;
    startPay(async () => { const r = await getStudentPayments(st.id); if (r.ok && r.data) setPay(r.data); });
  }, [st.id, canManage, canPay]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[94%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        {/* Header — foto/avatar + ism + holat */}
        <div className="relative shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-white dark:from-brand-950/40 dark:via-[#15243d] dark:to-[#15243d]" />
          <div className="relative flex items-start justify-between gap-3 px-5 py-5">
            <div className="flex min-w-0 items-center gap-3.5">
              {st.imageUrl ? (
                <span className="block h-16 w-16 shrink-0 rounded-full bg-cover bg-center shadow-sm ring-2 ring-white dark:ring-white/10" style={{ backgroundImage: `url(${st.imageUrl})` }} />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-sm ring-2 ring-white dark:ring-white/10" style={{ color: `hsl(${h} 55% 42%)`, background: `hsl(${h} 70% 92%)` }}><Icon name="user" className="h-8 w-8" /></span>
              )}
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{st.fullName}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: tone, background: `${tone}1f` }}>
                    {label(EDU_STATUS_LABELS, st.eduStatus, locale)}
                  </span>
                  {st.currentLevel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">{st.currentLevel}</span>}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* Tezkor oynadan to'liq profil sahifasiga o'tish */}
              <Link
                href={`/students/${st.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <Icon name="expand" className="h-3.5 w-3.5" /> {tr(locale, { uz: "To'liq profil", ru: "Полный профиль", en: "Full profile", de: "Vollständiges Profil" })}
              </Link>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* To'lov holati — bu oy / o'tgan oy to'lovi aniq ko'rinadi. Hisobchi (canManage=false, canPay=true) ham ko'rishi kerak */}
          {(canManage || canPay) && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Icon name="wallet" className="h-3.5 w-3.5" /> {tr(locale, { uz: "To'lov holati", ru: "Статус оплаты", en: "Payment status", de: "Zahlungsstatus" })}
                </div>
                {canPay && !payForm && !debtForm && (
                  <div className="flex gap-1.5">
                    {/* Qarzdor holatga tushurish — qo'lda qarz yozuvi */}
                    <button onClick={() => setDebtForm(true)} className="flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-500/10">
                      <Icon name="alert" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Qarz qo'shish", ru: "Добавить долг", en: "Add debt", de: "Schulden hinzufügen" })}
                    </button>
                    <button onClick={() => setPayForm(true)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-700">
                      <Icon name="plus" className="h-3.5 w-3.5" /> {tr(locale, { uz: "To'lov qabul qilish", ru: "Принять оплату", en: "Accept payment", de: "Zahlung annehmen" })}
                    </button>
                  </div>
                )}
              </div>

              {/* Majburiy to'lov — shu oy chegaradan ko'p dars o'tilgan, lekin to'lanmagan */}
              {pay?.paymentMandatory && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
                      <Icon name="alert" className="h-4 w-4 text-rose-600" />
                    </span>
                    <div>
                      <div className="text-sm font-bold text-rose-700 dark:text-rose-400">{tr(locale, { uz: "TO'LOV MAJBURIY", ru: "ОПЛАТА ОБЯЗАТЕЛЬНА", en: "PAYMENT MANDATORY", de: "ZAHLUNG ERFORDERLICH" })}</div>
                      <div className="text-xs text-rose-500 dark:text-rose-400/80">
                        {tr(locale, {
                          uz: `Shu oy ${pay.lessonsThisMonth} dars o'tildi (chegara: ${pay.mandatoryThreshold}), lekin to'lov qilinmagan.`,
                          ru: `В этом месяце проведено ${pay.lessonsThisMonth} уроков (лимит: ${pay.mandatoryThreshold}), оплата не произведена.`,
                          en: `${pay.lessonsThisMonth} lessons this month (limit: ${pay.mandatoryThreshold}), unpaid.`,
                          de: `${pay.lessonsThisMonth} Unterrichtsstunden diesen Monat (Limit: ${pay.mandatoryThreshold}), unbezahlt.`,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {debtForm && (
                <AddDebtForm
                  studentId={st.id}
                  locale={locale}
                  onCancel={() => setDebtForm(false)}
                  onDone={() => { setDebtForm(false); reloadPay(); }}
                />
              )}

              {payForm && (
                <PayAcceptForm
                  studentId={st.id}
                  defaultPurpose={st.courses[0] ? `${st.courses[0]} ${tr(locale, { uz: "kurs to'lovi", ru: "оплата курса", en: "course fee", de: "Kursgebühr" })}` : tr(locale, { uz: "Kurs to'lovi", ru: "Оплата курса", en: "Course fee", de: "Kursgebühr" })}
                  cashierName={cashierName}
                  receiptMode={receiptMode}
                  locale={locale}
                  onCancel={() => setPayForm(false)}
                  onDone={(r) => { setPayForm(false); setReceipt(r); reloadPay(); }}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <PayTile label={tr(locale, { uz: "Bu oy", ru: "Этот месяц", en: "This month", de: "Diesen Monat" })} m={pay?.thisMonth} loading={!pay} locale={locale} />
                {pay && !pay.lastMonthApplicable ? (
                  // Hali bir oy bo'lmagan (yaqinda kelgan) — "o'tgan oy" o'rniga qo'shilgan sanasi ko'rsatiladi
                  <JoinDateTile joinDate={pay.joinDate} locale={locale} />
                ) : (
                  <PayTile label={tr(locale, { uz: "O'tgan oy", ru: "Прошлый месяц", en: "Last month", de: "Letzten Monat" })} m={pay?.lastMonth} loading={!pay} locale={locale} />
                )}
              </div>

              {/* Jami qarzdorlik — PENDING to'lovlar yig'indisi */}
              {pay && (
                <div className={cn("mt-3 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5", pay.debt > 0
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20")}>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", pay.debt > 0 ? "bg-amber-500/15" : "bg-emerald-500/15")}>
                      <Icon name={pay.debt > 0 ? "info" : "check"} className={cn("h-4 w-4", pay.debt > 0 ? "text-amber-600" : "text-emerald-600")} />
                    </span>
                    <span className={cn("text-sm font-semibold", pay.debt > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                      {tr(locale, { uz: "Jami qarzdorlik", ru: "Общая задолженность", en: "Total debt", de: "Gesamtschulden" })}
                    </span>
                  </div>
                  <span className={cn("text-base font-black tabular-nums", pay.debt > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                    {pay.debt > 0 ? formatMoney(pay.debt, locale) : tr(locale, { uz: "Yo'q", ru: "Нет", en: "None", de: "Keine" })}
                  </span>
                </div>
              )}

              {pay && (
                pay.recent.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                      <span>{tr(locale, { uz: "So'nggi to'lovlar", ru: "Последние платежи", en: "Recent payments", de: "Letzte Zahlungen" })}</span>
                      <span className="tabular-nums">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}: {formatMoney(pay.totalPaid, locale)}</span>
                    </div>
                    {pay.recent.map((p) => (
                      <PaymentRow
                        key={p.id}
                        p={p}
                        locale={locale}
                        canEdit={canPay || canManage}
                        onChanged={() => { setPayForm(false); reloadPay(); }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:bg-white/[0.03]">{tr(locale, { uz: "Hali to'lov qilinmagan.", ru: "Оплат ещё не было.", en: "No payments yet.", de: "Noch keine Zahlungen." })}</p>
                )
              )}
            </div>
          )}

          {/* O'quv ma'lumotlari */}
          <DSection title={tr(locale, { uz: "O'quv ma'lumotlari", ru: "Учебные данные", en: "Study info", de: "Lerninformationen" })} icon="graduation">
            <div className="grid grid-cols-2 gap-3">
              <DStat label={tr(locale, { uz: "Balans", ru: "Баланс", en: "Balance", de: "Saldo" })} value={formatMoney(st.balance, locale)} accent={st.balance > 0} />
              <DStat label={tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level", de: "Niveau" })} value={st.currentLevel ?? "—"} />
              <DStat label={tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" })} value={st.branchName ?? "—"} />
              <DStat label={tr(locale, { uz: "Kurslar soni", ru: "Кол-во курсов", en: "Courses", de: "Kurse" })} value={String(st.courses.length)} />
            </div>
          </DSection>

          {/* Kontakt */}
          <DSection title={tr(locale, { uz: "Kontakt", ru: "Контакт", en: "Contact", de: "Kontakt" })} icon="phone">
            {st.phone ? (
              <a href={`tel:${st.phone}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                <Icon name="phone" className="h-4 w-4 text-brand-500" /> {st.phone}
              </a>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </DSection>

          {/* Guruhlar — katta boxlar */}
          <DSection title={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })} icon="layers">
            {st.groups.length === 0 ? (
              <p className="text-sm text-slate-400">—</p>
            ) : (
              <div className="space-y-1.5">
                {st.groups.map((g) => <BigRow key={g.id} icon="layers" text={g.name} href={`/groups/${g.id}`} onNav={onClose} />)}
              </div>
            )}
          </DSection>

          {/* O'qituvchilar — katta boxlar */}
          {st.teachers.length > 0 && (
            <DSection title={tr(locale, { uz: "O'qituvchilar", ru: "Преподаватели", en: "Teachers", de: "Lehrer" })} icon="teacher">
              <div className="space-y-1.5">
                {st.teachers.map((t, i) => <BigRow key={i} icon="teacher" text={t} />)}
              </div>
            </DSection>
          )}

          {/* Kurslar — katta boxlar */}
          {st.courses.length > 0 && (
            <DSection title={tr(locale, { uz: "Kurslar", ru: "Курсы", en: "Courses", de: "Kurse" })} icon="book">
              <div className="space-y-1.5">
                {st.courses.map((c, i) => <BigRow key={i} icon="book" text={c} />)}
              </div>
            </DSection>
          )}

          {/* Mashg'ulot sanalari — katta boxlar */}
          {st.scheduleDates.length > 0 && (
            <DSection title={tr(locale, { uz: "Mashg'ulot sanalari", ru: "Даты занятий", en: "Lesson dates", de: "Unterrichtstermine" })} icon="calendar">
              <div className="space-y-1.5">
                {st.scheduleDates.map((d, i) => <BigRow key={i} icon="calendar" text={fmtDate(d)} />)}
              </div>
            </DSection>
          )}

          {/* Izoh */}
          {st.note && (
            <DSection title={tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" })} icon="edit">
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">{st.note}</p>
            </DSection>
          )}
        </div>

        {/* Footer amallari. Arxiv va o'chirish tahrirlash oynasi ichida. */}
        {canManage && (
          <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-5 py-3 dark:border-white/10 dark:bg-[#15243d]">
            <button onClick={onEdit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[.99]">
              <Icon name="pencil" className="h-4 w-4" /> {tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}
            </button>
            {st.phone && (
              <a href={`tel:${st.phone}`} title={st.phone} className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/10">
                <Icon name="phone" className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
      {receipt && <ReceiptModal receipt={receipt} locale={locale} onClose={() => setReceipt(null)} />}
    </div>, document.body);
}

// Qarzdor holatga tushurish — qo'lda qarz yozuvi (PENDING to'lov) ochadi.
function AddDebtForm({ studentId, locale, onCancel, onDone }: {
  studentId: string; locale: Locale; onCancel: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });
  const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  const submit = () => start(async () => {
    const r = await addStudentDebt(studentId, { amount: Number(amount), purpose });
    if (r.ok) onDone();
    else setErr(r.error === "amount" ? L("Summani to'g'ri kiriting.", "Введите корректную сумму.", "Enter a valid amount.")
      : r.error === "forbidden" ? L("Ruxsat yo'q.", "Нет доступа.", "No permission.")
      : L("Saqlanmadi.", "Не сохранено.", "Not saved."));
  });

  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
        {L("Qarzdor holatga tushurish", "Перевести в должники", "Mark as debtor")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Summa (so'm)", "Сумма (сум)", "Amount (UZS)")} *</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="0" className={inp} />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Izoh", "Комментарий", "Note")}</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={L("Kurs to'lovi qarzi", "Долг за курс", "Course fee debt")} className={inp} />
        </div>
      </div>
      {err && <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancel} disabled={pending} className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          {L("Bekor qilish", "Отмена", "Cancel")}
        </button>
        <button type="button" onClick={submit} disabled={pending || !amount} className="flex-[1.4] rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-40">
          {pending ? "..." : L("Qarz qo'shish", "Добавить долг", "Add debt")}
        </button>
      </div>
    </div>
  );
}

// Bitta to'lov qatori — tahrirlash va o'chirish bilan (2026-08-27 talab).
// Noto'g'ri kiritilgan summa/usul/holat shu yerdan tuzatiladi.
function PaymentRow({ p, locale, canEdit, onChanged }: {
  p: PayRow; locale: Locale; canEdit: boolean; onChanged: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [amount, setAmount] = useState(String(p.amount));
  const [method, setMethod] = useState(p.method);
  const [status, setStatus] = useState(p.status);
  const [purpose, setPurpose] = useState(p.purpose ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });
  const ps = payStatusStyle(p.status);

  const save = () => start(async () => {
    const r = await updatePaymentRecord(p.id, { amount: Number(amount), method, status, purpose });
    if (r.ok) { setEdit(false); onChanged(); }
    else setErr(r.error === "forbidden" ? L("Ruxsat yo'q.", "Нет доступа.", "No permission.") : L("Saqlanmadi.", "Не сохранено.", "Not saved."));
  });

  const remove = () => start(async () => {
    const r = await deletePaymentRecord(p.id);
    if (r.ok) onChanged();
    else setErr(L("O'chirilmadi.", "Не удалено.", "Not deleted."));
  });

  const inp = "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  if (!edit) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 dark:border-white/5">
        <div className="min-w-0">
          <div className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatMoney(p.amount, locale)}</div>
          <div className="truncate text-[11px] text-slate-400">{fmtDate(p.date)} · {p.method}{p.purpose ? ` · ${p.purpose}` : ""}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: ps.fg, background: ps.bg }}>{label(PAYMENT_STATUS_LABELS, p.status, locale)}</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => { setEdit(true); setErr(null); }}
              title={L("Tahrirlash", "Изменить", "Edit")}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
            >
              <Icon name="pencil" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-2.5 dark:border-brand-500/30 dark:bg-brand-500/10">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Summa", "Сумма", "Amount")}</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inp} />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Usul", "Способ", "Method")}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inp}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(PAYMENT_METHOD_LABELS, m, locale)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Holat", "Статус", "Status")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
            {["PAID", "PENDING", "REFUNDED", "CANCELLED"].map((x) => <option key={x} value={x}>{label(PAYMENT_STATUS_LABELS, x, locale)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold text-slate-500">{L("Maqsad", "Назначение", "Purpose")}</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inp} />
        </div>
      </div>
      {err && <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => setEdit(false)} disabled={pending} className="flex-1 rounded-md border border-slate-200 bg-white py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          {L("Bekor", "Отмена", "Cancel")}
        </button>
        <button type="button" onClick={remove} disabled={pending} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-400">
          {L("O'chirish", "Удалить", "Delete")}
        </button>
        <button type="button" onClick={save} disabled={pending || !amount} className="flex-1 rounded-md bg-brand-600 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40">
          {pending ? "..." : L("Saqlash", "Сохранить", "Save")}
        </button>
      </div>
    </div>
  );
}

// O'chirish amallari: arxivlash (qaytariladi) va mutloq o'chirish (qaytarilmaydi).
// Mutloq o'chirishda to'lov tarixi ham yo'qoladi — shu sabab ism yozib tasdiqlanadi
// va server tomonda faqat direktor/o'rinbosariga ruxsat beriladi.
function StudentDangerActions({ student: st, locale, onDone }: { student: VStudent; locale: Locale; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"none" | "purge">("none");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });

  const archived = st.eduStatus === "ARCHIVED";
  const errText = (code?: string) =>
    code === "forbidden"
      ? L("Bu amal faqat direktor va o'rinbosariga ruxsat etilgan.", "Действие доступно только директору и заместителю.", "Only the director and deputy may do this.")
      : L("Amal bajarilmadi.", "Не удалось выполнить.", "Action failed.");

  const runArchive = () => start(async () => {
    const r = archived ? await restoreStudent(st.id) : await archiveStudent(st.id);
    if (r.ok) { router.refresh(); onDone(); } else setErr(errText(r.error));
  });

  const runPurge = () => start(async () => {
    const r = await deleteStudentPermanently(st.id);
    if (r.ok) { router.refresh(); onDone(); } else setErr(errText(r.error));
  });

  return (
    <div>
      {/* Arxivlash va butunlay o'chirish */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={runArchive}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
        >
          <Icon name={archived ? "refresh" : "personOff"} className="h-4 w-4 shrink-0" />
          {archived ? L("Arxivdan qaytarish", "Вернуть из архива", "Restore") : L("Arxivlash", "В архив", "Archive")}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === "purge" ? "none" : "purge"); setTyped(""); setErr(null); }}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
        >
          <Icon name="trash" className="h-4 w-4 shrink-0" />
          {L("Butunlay o'chirish", "Удалить навсегда", "Delete permanently")}
        </button>
      </div>

      {mode === "purge" && (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
            {L(
              "Diqqat: o'quvchi bilan birga davomat, to'lov tarixi va sertifikatlari ham butunlay o'chadi. Qaytarib bo'lmaydi.",
              "Внимание: вместе с учеником безвозвратно удалятся посещаемость, история платежей и сертификаты.",
              "Warning: attendance, payment history and certificates are deleted with the student. This cannot be undone.",
            )}
          </p>
          <p className="mt-2 text-[11px] font-medium text-rose-700 dark:text-rose-300">
            {L("Tasdiqlash uchun ismini yozing:", "Для подтверждения введите имя:", "Type the name to confirm:")}{" "}
            <span className="font-bold">{st.fullName}</span>
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            // Enter tahrirlash formasini yubormasin
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            className="mt-1.5 h-9 w-full rounded-lg border border-rose-200 bg-white px-2.5 text-sm outline-none focus:border-rose-400 dark:border-rose-500/30 dark:bg-slate-900 dark:text-slate-100"
          />
          {err && <p className="mt-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">{err}</p>}
          {/* type="button" SHART — bu blok tahrirlash formasi ichida turadi */}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => { setMode("none"); setErr(null); }}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            >
              {L("Bekor qilish", "Отмена", "Cancel")}
            </button>
            <button
              type="button"
              onClick={runPurge}
              disabled={pending || typed.trim() !== st.fullName.trim()}
              className="flex-[1.4] rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
            >
              {pending ? L("O'chirilmoqda...", "Удаление...", "Deleting...") : L("Ha, butunlay o'chirilsin", "Да, удалить навсегда", "Yes, delete permanently")}
            </button>
          </div>
        </div>
      )}
      {mode === "none" && err && <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
    </div>
  );
}

// To'lov qabul qilish formasi (drawer ichida ochiladi) — Naqd / Karta / Bank hisobi.
// Chek majburiymi — CEO sozlamasidan keladi (receiptMode), qattiq yozilmagan.
function PayAcceptForm({ studentId, defaultPurpose, cashierName, locale, receiptMode, onCancel, onDone }: {
  studentId: string;
  defaultPurpose: string;
  cashierName: string;
  locale: Locale;
  receiptMode: ReceiptMode;
  onCancel: () => void;
  onDone: (r: ReceiptData) => void;
}) {
  const nowLocal = () => {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [amountStr, setAmountStr] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "BANK">("CASH");
  const [paidAt, setPaidAt] = useState(nowLocal());
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const setAmount = (v: string) => {
    const digits = v.replace(/\D/g, "");
    setAmountStr(digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");
  };

  const onPickChek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null); setUploading(true); setPct(0);
    const fd = new FormData(); fd.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setPct(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => { setUploading(false); try { const j = JSON.parse(xhr.responseText); if (xhr.status < 300 && j.url) setReceiptUrl(j.url); else setErr(tr(locale, { uz: "Chekni yuklab bo'lmadi", ru: "Не удалось загрузить чек", en: "Receipt upload failed", de: "Beleg-Upload fehlgeschlagen" })); } catch { setErr(tr(locale, { uz: "Chekni yuklab bo'lmadi", ru: "Не удалось загрузить чек", en: "Receipt upload failed", de: "Beleg-Upload fehlgeschlagen" })); } };
    xhr.onerror = () => { setUploading(false); setErr(tr(locale, { uz: "Chekni yuklab bo'lmadi", ru: "Не удалось загрузить чек", en: "Receipt upload failed", de: "Beleg-Upload fehlgeschlagen" })); };
    xhr.send(fd);
  };

  const submit = () => {
    setErr(null);
    const amount = Number(amountStr.replace(/\s/g, ""));
    if (!amount || amount <= 0) { setErr(tr(locale, { uz: "Summani kiriting", ru: "Введите сумму", en: "Enter amount", de: "Betrag eingeben" })); return; }
    if (isReceiptRequired(receiptMode, method) && !receiptUrl) {
      setErr(tr(locale, { uz: "Bu to'lov uchun chek yuklash majburiy", ru: "Для этой оплаты чек обязателен", en: "A receipt is required for this payment", de: "Für diese Zahlung ist ein Beleg erforderlich" }));
      return;
    }
    startBusy(async () => {
      const r = await acceptPayment(studentId, { amount, method, purpose: defaultPurpose, receiptUrl: receiptUrl || null, paidAt: new Date(paidAt).toISOString() });
      if (r.ok && r.receipt) onDone(r.receipt);
      else if (r.error === "receipt_required") setErr(tr(locale, { uz: "Karta to'lovi uchun chek yuklang", ru: "Загрузите чек", en: "Upload receipt", de: "Beleg hochladen" }));
      else setErr(tr(locale, { uz: "Xatolik yuz berdi", ru: "Произошла ошибка", en: "An error occurred", de: "Ein Fehler ist aufgetreten" }));
    });
  };

  const fld = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";
  const tab = (active: boolean) => cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition", active ? "border-brand-500 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-500 hover:border-brand-300 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300");

  return (
    <div className="mb-3 space-y-2.5 rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900/50 dark:bg-brand-950/20">
      {/* To'lov turi */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "To'lov turi", ru: "Тип оплаты", en: "Payment type", de: "Zahlungsart" })}</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMethod("CASH")} className={tab(method === "CASH")}><Icon name="wallet" className="h-4 w-4" /> {tr(locale, { uz: "Naqd", ru: "Наличные", en: "Cash", de: "Bar" })}</button>
          <button type="button" onClick={() => setMethod("CARD")} className={tab(method === "CARD")}><Icon name="card" className="h-4 w-4" /> {tr(locale, { uz: "Karta", ru: "Карта", en: "Card", de: "Karte" })}</button>
          <button type="button" onClick={() => setMethod("BANK")} className={tab(method === "BANK")}><Icon name="building" className="h-4 w-4" /> {tr(locale, { uz: "Bank hisobi", ru: "Банк. счёт", en: "Bank", de: "Bank" })}</button>
        </div>
      </div>

      {/* Summa */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "Summa (so'm)", ru: "Сумма (сум)", en: "Amount (sum)", de: "Betrag (UZS)" })}</label>
        <input inputMode="numeric" value={amountStr} onChange={(e) => setAmount(e.target.value)} placeholder="500 000" className={cn(fld, "font-semibold tabular-nums")} autoFocus />
      </div>

      {/* Vaqt */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-slate-500">{tr(locale, { uz: "To'lov vaqti", ru: "Время оплаты", en: "Payment time", de: "Zahlungszeit" })}</label>
        <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={fld} />
      </div>

      {/* Kim qabul qildi (kassir) */}
      <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-xs dark:bg-slate-800/40">
        <span className="text-slate-400">{tr(locale, { uz: "Qabul qildi", ru: "Принял", en: "Received by", de: "Angenommen von" })}</span>
        <span className="font-semibold text-slate-600 dark:text-slate-200">{cashierName}</span>
      </div>

      {/* Chek yuklash — sozlamaga qarab (ixtiyoriy bo'lsa ham yuklash mumkin) */}
      {(
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            {tr(locale, { uz: "Chek (rasm yoki PDF)", ru: "Чек (фото или PDF)", en: "Receipt (image or PDF)", de: "Beleg (Bild oder PDF)" })}
            {isReceiptRequired(receiptMode, method) ? (
              <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                {tr(locale, { uz: "majburiy", ru: "обязательно", en: "required", de: "erforderlich" })}
              </span>
            ) : (
              <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {tr(locale, { uz: "ixtiyoriy", ru: "необязательно", en: "optional", de: "optional" })}
              </span>
            )}
          </label>
          {receiptUrl ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-500" />
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-emerald-700 hover:underline dark:text-emerald-400">{receiptUrl.split("/").pop()}</a>
              <button type="button" onClick={() => setReceiptUrl("")} className="shrink-0 text-rose-500 hover:text-rose-600">✕</button>
            </div>
          ) : uploading ? (
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Uploading...", de: "Wird hochgeladen..." })}</span><span className="font-semibold tabular-nums">{pct}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400">
              <Icon name="download" className="h-4 w-4 rotate-180" /> {tr(locale, { uz: "Chek yuklash", ru: "Загрузить чек", en: "Upload receipt", de: "Beleg hochladen" })}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPickChek} />
        </div>
      )}

      {err && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="flex gap-2 pt-0.5">
        <button onClick={submit} disabled={busy || uploading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
          {busy ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="check" className="h-4 w-4" />}
          {tr(locale, { uz: "Qabul qilish va chek", ru: "Принять и чек", en: "Accept & receipt", de: "Annehmen & Beleg" })}
        </button>
        <button onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-white/10">
          {tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
        </button>
      </div>
    </div>
  );
}

const PAY_METHOD_OPTS: { v: string; l: Record<Locale, string> }[] = [
  { v: "CASH", l: { uz: "Naqd", ru: "Наличные", en: "Cash", de: "Bar" } },
  { v: "CARD", l: { uz: "Karta", ru: "Карта", en: "Card", de: "Karte" } },
  { v: "CLICK", l: { uz: "Click", ru: "Click", en: "Click", de: "Click" } },
  { v: "PAYME", l: { uz: "Payme", ru: "Payme", en: "Payme", de: "Payme" } },
  { v: "UZUM", l: { uz: "Uzum", ru: "Uzum", en: "Uzum", de: "Uzum" } },
  { v: "TRANSFER", l: { uz: "O'tkazma", ru: "Перевод", en: "Transfer", de: "Überweisung" } },
];

// ─── CHEK (to'lov kviatansiyasi) — chop etsa bo'ladi ───
function ReceiptModal({ receipt: r, locale, onClose }: { receipt: ReceiptData; locale: Locale; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;

  const d = new Date(r.dateIso);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const methodLabel = PAY_METHOD_OPTS.find((m) => m.v === r.method);
  const row = "flex justify-between gap-3 py-1 text-[13px]";

  return createPortal(
    <>
      <style>{`@media print {
        body > *:not(#gl-receipt-print) { display: none !important; }
        #gl-receipt-print { position: absolute !important; inset: 0 !important; background: #fff !important; }
        #gl-receipt-print .gl-no-print { display: none !important; }
        #gl-receipt-card { box-shadow: none !important; border: none !important; margin: 0 auto !important; }
      }`}</style>
      <div id="gl-receipt-print" className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm sm:pt-16" onMouseDown={onClose}>
        <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-[360px]">
          {/* Chek qog'ozi */}
          <div id="gl-receipt-card" className="rounded-t-2xl bg-white px-6 py-6 text-slate-800 shadow-pop">
            <div className="text-center">
              <div className="text-lg font-black uppercase tracking-tight text-slate-900">{r.orgName}</div>
              {r.branchName && <div className="mt-0.5 text-xs font-medium text-slate-500">{r.branchName}</div>}
              {r.branchAddress && <div className="text-[11px] text-slate-400">{r.branchAddress}</div>}
              {r.branchPhone && <div className="text-[11px] text-slate-400">{r.branchPhone}</div>}
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{tr(locale, { uz: "To'lov cheki", ru: "Чек об оплате", en: "Payment receipt", de: "Zahlungsbeleg" })}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">№ {r.docNumber}</div>
              <div className="text-[11px] text-slate-400">{dateStr}</div>
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="space-y-0.5">
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" })}</span><span className="text-right font-semibold text-slate-700">{r.studentName}</span></div>
              {r.studentPhone && <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</span><span className="text-right text-slate-600">{r.studentPhone}</span></div>}
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Maqsad", ru: "Назначение", en: "Purpose", de: "Zweck" })}</span><span className="text-right text-slate-600">{r.purpose}</span></div>
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Usul", ru: "Способ", en: "Method", de: "Methode" })}</span><span className="text-right text-slate-600">{methodLabel ? tr(locale, methodLabel.l) : r.method}</span></div>
              <div className={row}><span className="text-slate-400">{tr(locale, { uz: "Kassir", ru: "Кассир", en: "Cashier", de: "Kassierer" })}</span><span className="text-right text-slate-600">{r.cashier}</span></div>
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase text-slate-500">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</span>
              <span className="text-xl font-black tabular-nums text-slate-900">{formatMoney(r.amount, locale)}</span>
            </div>

            <div className="mt-4 text-center text-[11px] italic text-slate-400">{r.footer}</div>
          </div>

          {/* Yuklangan chek fayli (karta to'lovi) — chop etilmaydi */}
          {r.receiptUrl && (
            <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="gl-no-print flex items-center gap-2 bg-white/95 px-4 pt-2 text-xs font-medium text-brand-600 hover:underline">
              <Icon name="card" className="h-4 w-4" /> {tr(locale, { uz: "Yuklangan chekni ko'rish", ru: "Открыть загруженный чек", en: "View uploaded receipt", de: "Hochgeladenen Beleg ansehen" })}
            </a>
          )}

          {/* Amallar (chekda chop etilmaydi) */}
          <div className="gl-no-print flex gap-2 rounded-b-2xl bg-white/95 px-4 pb-4 pt-1">
            <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Icon name="printer" className="h-4 w-4" /> {tr(locale, { uz: "Chop etish", ru: "Печать", en: "Print", de: "Drucken" })}
            </button>
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100">
              {tr(locale, { uz: "Yopish", ru: "Закрыть", en: "Close", de: "Schließen" })}
            </button>
          </div>
        </div>
      </div>
    </>, document.body);
}

function DSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}
function DStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 transition hover:border-slate-200 dark:border-white/5 dark:bg-white/[0.03]">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className={cn("mt-0.5 truncate text-sm font-bold tabular-nums", accent ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>{value}</div>
    </div>
  );
}

// Katta ma'lumot qatori (KONTAKT uslubida) — o'qituvchi/guruh/kurs/sana
function BigRow({ icon, text, href, onNav }: { icon: string; text: string; href?: string; onNav?: () => void }) {
  const cls = "flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200";
  const inner = <><Icon name={icon} className="h-4 w-4 shrink-0 text-brand-500" /><span className="min-w-0 break-words">{text}</span></>;
  return href
    ? <Link href={href} onClick={onNav} className={cn(cls, "transition hover:border-brand-300 hover:text-brand-600")}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

// Oy to'lovi katakchasi — to'langan (yashil) yoki to'lanmagan (qizil)
// Yaqinda kelgan (hali bir oy bo'lmagan) o'quvchi uchun "o'tgan oy" o'rniga qo'shilgan sanasi
function JoinDateTile({ joinDate, locale }: { joinDate: string | null; locale: Locale }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 dark:border-brand-900/40 dark:bg-brand-950/20">
      <div className="text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Kelgan sanasi", ru: "Дата прихода", en: "Join date", de: "Beitrittsdatum" })}</div>
      <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-brand-700 dark:text-brand-300">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500/15"><Icon name="calendar" className="h-3 w-3" /></span>
        {joinDate ? fmtDate(joinDate) : "—"}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-400">{tr(locale, { uz: "Hali 1 oy bo'lmagan", ru: "Ещё нет месяца", en: "Less than a month", de: "Weniger als ein Monat" })}</div>
    </div>
  );
}

function PayTile({ label: lbl, m, loading, locale }: { label: string; m?: MonthPay; loading: boolean; locale: Locale }) {
  if (loading || !m) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
        <div className="text-[11px] font-medium text-slate-400">{lbl}</div>
        <div className="mt-1.5 h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5", m.paid
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20")}>
      <div className="text-[11px] font-medium text-slate-400">{lbl}</div>
      <div className={cn("mt-1 flex items-center gap-1.5 text-sm font-bold", m.paid ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full", m.paid ? "bg-emerald-500/15" : "bg-rose-500/15")}><Icon name={m.paid ? "check" : "close"} className="h-3 w-3" /></span>
        {m.paid ? tr(locale, { uz: "To'langan", ru: "Оплачено", en: "Paid", de: "Bezahlt" }) : tr(locale, { uz: "To'lanmagan", ru: "Не оплачено", en: "Unpaid", de: "Unbezahlt" })}
      </div>
      {m.paid && (
        <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {formatMoney(m.amount, locale)}{m.date ? ` · ${fmtDate(m.date)}` : ""}
        </div>
      )}
    </div>
  );
}

// To'lov statusi rangi (chip)
function payStatusStyle(status: string): { fg: string; bg: string } {
  switch (status) {
    case "PAID": return { fg: "#16a34a", bg: "#16a34a1a" };
    case "PENDING": return { fg: "#d97706", bg: "#d977061a" };
    case "REFUNDED": return { fg: "#0891b2", bg: "#0891b21a" };
    case "CANCELLED": return { fg: "#dc2626", bg: "#dc26261a" };
    default: return { fg: "#64748b", bg: "#64748b1a" };
  }
}

// ───────────── Yordamchi komponentlar ─────────────

function Select({
  value, onChange, placeholder, children,
}: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-900",
        value ? "text-slate-700 dark:text-slate-200" : "text-slate-400"
      )}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

// Ma'lumot hali yo'q — vizual (o'chirilgan) filtr, Modme ko'rinishiga mos
function SelectDisabled({ placeholder, locale }: { placeholder: string; locale: Locale }) {
  return (
    <div className="flex h-10 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900/40" title={tr(locale, { uz: "Tez orada", ru: "Скоро", en: "Coming soon", de: "Demnächst" })}>
      {placeholder}
      <Icon name="chevronDown" className="h-3.5 w-3.5" />
    </div>
  );
}
function InputDisabled({ placeholder, icon, locale }: { placeholder: string; icon?: string; locale: Locale }) {
  return (
    <div className="flex h-10 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900/40" title={tr(locale, { uz: "Tez orada", ru: "Скоро", en: "Coming soon", de: "Demnächst" })}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {placeholder}
    </div>
  );
}

function HeadAction({ icon, title, active, onClick }: { icon: string; title: string; active: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={title}
      disabled={!active}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border transition",
        active
          ? "border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          : "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600"
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

// Ommaviy amal modali — guruhga biriktirish yoki xabar yuborish
function BulkModal({
  mode, count, groups, busy, locale, onClose, onAssign, onMessage,
}: {
  mode: "assign" | "message";
  count: number;
  groups: { id: string; name: string }[];
  busy: boolean;
  locale: Locale;
  onClose: () => void;
  onAssign: (groupId: string) => void;
  onMessage: (msg: string) => void;
}) {
  const [gid, setGid] = useState("");
  const [msg, setMsg] = useState("");
  const fld = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{mode === "assign" ? tr(locale, { uz: "Guruhga biriktirish", ru: "Привязать к группе", en: "Assign to group", de: "Gruppe zuweisen" }) : tr(locale, { uz: "Xabar yuborish", ru: "Отправить сообщение", en: "Send message", de: "Nachricht senden" })}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-slate-500"><b className="text-slate-700 dark:text-slate-200">{count}</b> {tr(locale, { uz: "ta o'quvchi tanlangan.", ru: "ученик(ов) выбрано.", en: "student(s) selected.", de: "Schüler ausgewählt." })}</p>

        {mode === "assign" ? (
          <>
            <select value={gid} onChange={(e) => setGid(e.target.value)} className={fld}>
              <option value="">{tr(locale, { uz: "Guruhni tanlang", ru: "Выберите группу", en: "Select a group", de: "Gruppe auswählen" })}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {groups.length === 0 && <p className="text-xs text-amber-500">{tr(locale, { uz: "Guruhlar topilmadi.", ru: "Группы не найдены.", en: "No groups found.", de: "Keine Gruppen gefunden." })}</p>}
            <button disabled={!gid || busy} onClick={() => onAssign(gid)} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {busy ? "..." : tr(locale, { uz: "Biriktirish", ru: "Привязать", en: "Assign", de: "Zuweisen" })}
            </button>
          </>
        ) : (
          <>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} placeholder={tr(locale, { uz: "Xabar matni...", ru: "Текст сообщения...", en: "Message text...", de: "Nachrichtentext..." })} className={fld} />
            <button disabled={msg.trim().length < 2 || busy} onClick={() => onMessage(msg)} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {busy ? "..." : tr(locale, { uz: "Yuborish", ru: "Отправить", en: "Send", de: "Senden" })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Pager({ page, pageCount, onGo }: { page: number; pageCount: number; onGo: (p: number) => void }) {
  const nums: number[] = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pageCount, from + 4);
  for (let i = from; i <= to; i++) nums.push(i);

  const arrow = "flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition enabled:hover:bg-slate-100 disabled:opacity-30 dark:enabled:hover:bg-slate-800";
  return (
    <div className="flex items-center gap-1">
      <button disabled={page <= 1} onClick={() => onGo(1)} className={arrow}>«</button>
      <button disabled={page <= 1} onClick={() => onGo(page - 1)} className={arrow}>‹</button>
      {nums.map((n) => (
        <button
          key={n}
          onClick={() => onGo(n)}
          className={cn(
            "flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-medium transition",
            n === page ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          {n}
        </button>
      ))}
      <button disabled={page >= pageCount} onClick={() => onGo(page + 1)} className={arrow}>›</button>
      <button disabled={page >= pageCount} onClick={() => onGo(pageCount)} className={arrow}>»</button>
    </div>
  );
}

function CreateModal({ locale, onClose, onDone }: { locale: Locale; onClose: () => void; onDone: () => void }) {
  const [state, action, pending] = useActionState<QuickState, FormData>(quickCreateStudent, {});
  const done = useRef(false);
  useEffect(() => {
    if (state.ok && !done.current) { done.current = true; onDone(); onClose(); }
  }, [state.ok, onDone, onClose]);

  // Escape bilan yopish + fon scroll'ini bloklash (boshqa drawer'lar kabi)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const labelCls = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
  const inputCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        action={action}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Yangi talaba", ru: "Новый ученик", en: "New student", de: "Neuer Schüler" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={labelCls}>{tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name", de: "Vollständiger Name" })} <span className="text-rose-500">*</span></label>
            <input name="fullName" required className={inputCls} placeholder={tr(locale, { uz: "Ism Familiya", ru: "Имя Фамилия", en: "First Last name", de: "Vorname Nachname" })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</label>
              <input name="phone" className={inputCls} placeholder="+998..." />
            </div>
            <div>
              <label className={labelCls}>{tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level", de: "Niveau" })}</label>
              <input name="currentLevel" className={inputCls} placeholder="A1.1" />
            </div>
          </div>
          {/* Qarzdor qilib qo'shish — kiritilsa qarz yozuvi ochiladi (Qarzdorlar ro'yxatiga tushadi) */}
          <div>
            <label className={labelCls}>
              {tr(locale, { uz: "Qarz (so'm)", ru: "Долг (сум)", en: "Debt (UZS)", de: "Schulden (UZS)" })}
              <span className="ml-1 font-normal text-slate-400">({tr(locale, { uz: "ixtiyoriy", ru: "необязательно", en: "optional", de: "optional" })})</span>
            </label>
            <input name="debt" type="number" min="0" step="10000" className={inputCls} placeholder="0" />
            <p className="mt-1 text-[11px] text-slate-400">
              {tr(locale, {
                uz: "Kiritilsa talaba qarzdor sifatida qo'shiladi va Qarzdorlar ro'yxatida ko'rinadi.",
                ru: "Если указать, ученик будет добавлен как должник и попадёт в список должников.",
                en: "If set, the student is added as a debtor and appears in the debtors list.",
                de: "Wenn angegeben, wird der Schüler als Schuldner hinzugefügt und erscheint in der Schuldnerliste.",
              })}
            </p>
          </div>
          {state.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              {state.error === "forbidden" ? tr(locale, { uz: "Sizda talaba qo'shish huquqi yo'q.", ru: "У вас нет права добавлять учеников.", en: "You do not have permission to add students.", de: "Sie haben keine Berechtigung, Schüler hinzuzufügen." }) : tr(locale, { uz: "Ma'lumot to'liq emas.", ru: "Данные неполные.", en: "Information is incomplete.", de: "Die Angaben sind unvollständig." })}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
        </div>
      </form>
    </div>
  );
}

function EditModal({ student, locale, onClose, onDone }: { student: VStudent; locale: Locale; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Escape bilan yopish + fon scroll'ini bloklash
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", student.id);
    start(async () => {
      const r = await updateStudent(fd);
      if (r.ok) { onDone(); onClose(); }
      else setError(r.error === "forbidden" ? tr(locale, { uz: "Sizda tahrirlash huquqi yo'q.", ru: "У вас нет права редактировать.", en: "You do not have permission to edit.", de: "Sie haben keine Berechtigung zum Bearbeiten." }) : tr(locale, { uz: "Ma'lumot to'liq emas.", ru: "Данные неполные.", en: "Information is incomplete.", de: "Die Angaben sind unvollständig." }));
    });
  };

  const labelCls = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
  const inputCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Talabani tahrirlash", ru: "Редактировать ученика", en: "Edit student", de: "Schüler bearbeiten" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div>
            <label className={labelCls}>{tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name", de: "Vollständiger Name" })} <span className="text-rose-500">*</span></label>
            <input name="fullName" required defaultValue={student.fullName} className={inputCls} placeholder={tr(locale, { uz: "Ism Familiya", ru: "Имя Фамилия", en: "First Last name", de: "Vorname Nachname" })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</label>
              <input name="phone" defaultValue={student.phone ?? ""} className={inputCls} placeholder="+998..." />
            </div>
            <div>
              <label className={labelCls}>{tr(locale, { uz: "Daraja", ru: "Уровень", en: "Level", de: "Niveau" })}</label>
              <input name="currentLevel" defaultValue={student.currentLevel ?? ""} className={inputCls} placeholder="A1.1" />
            </div>
          </div>
          {/* Izoh — talaba profili, ro'yxat va kartochkada ko'rinadi */}
          <div>
            <label className={labelCls}>{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" })}</label>
            <textarea
              name="note"
              rows={3}
              maxLength={2000}
              defaultValue={student.note ?? ""}
              placeholder={tr(locale, {
                uz: "Talaba haqida qo'shimcha ma'lumot (masalan: dars kunlari cheklovi, ota-ona iltimosi)",
                ru: "Дополнительная информация об ученике (например: ограничения по дням, просьба родителей)",
                en: "Additional info about the student (e.g. day restrictions, parent request)",
                de: "Zusätzliche Informationen zum Schüler (z. B. Einschränkungen bei Unterrichtstagen, Elternwunsch)",
              })}
              className={`${inputCls} h-auto resize-y py-2 leading-relaxed`}
            />
          </div>
          <div>
            <label className={labelCls}>{tr(locale, { uz: "O'quv holati", ru: "Учебный статус", en: "Education status", de: "Ausbildungsstatus" })}</label>
            <select name="eduStatus" defaultValue={student.eduStatus} className={inputCls}>
              {EDU_STATUSES.map((st) => (
                <option key={st} value={st}>{label(EDU_STATUS_LABELS, st, locale)}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>
          )}

          {/* Boshqa filialga ko'chirish */}
          <div className="mt-2 border-t border-slate-100 pt-3.5 dark:border-white/10">
            <BranchMover
              locale={locale}
              currentBranchName={student.branchName}
              warning={tr(locale, {
                uz: "Diqqat: o'quvchi eski filialdagi guruhlardan chiqariladi (to'lov hisobi ham shu oyda to'xtaydi).",
                ru: "Внимание: ученик будет выведен из групп прежнего филиала (начисление оплаты также прекратится).",
                en: "Note: the student is removed from the previous branch's groups (fee accrual stops this month).",
                de: "Hinweis: Der Schüler wird aus den Gruppen der vorherigen Filiale entfernt (die Gebührenberechnung endet diesen Monat).",
              })}
              loadBranches={studentBranchOptions}
              onMove={(branchId) => moveStudentToBranch(student.id, branchId)}
            />
          </div>

          {/* Arxivlash va butunlay o'chirish — tahrirlash oynasi ichida */}
          <div className="mt-2 border-t border-slate-100 pt-3.5 dark:border-white/10">
            <p className={labelCls}>{tr(locale, { uz: "Talabani o'chirish", ru: "Удаление ученика", en: "Remove student", de: "Schüler entfernen" })}</p>
            <StudentDangerActions student={student} locale={locale} onDone={onClose} />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
          <button type="submit" disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
        </div>
      </form>
    </div>
  );
}
