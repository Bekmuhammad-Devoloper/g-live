"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { exportRows } from "@/lib/export";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { createStaff, toggleStaffActive } from "./actions";
import StaffDetailModal from "./StaffDetailModal";

export interface VStaff {
  id: string; name: string; gender: string | null; students: number; groups: { id: string; name: string }[];
  role: string; roleLabel: string; branch: string | null; phone: string | null; courses: string[]; active: boolean;
}
interface Opt { id: string; name: string }

export interface PosOpt { value: string; label: string; department: string }

export default function UsersView({ staff, positions, branches, canManage, locale }: {
  staff: VStaff[]; positions: PosOpt[]; branches: Opt[]; canManage: boolean; locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [status, setStatus] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Filtr — jadvalda ko'rsatilgan lavozim (roleLabel) bo'yicha, RBAC roli bo'yicha emas.
  // Sabab: bir nechta lavozim (ROP, Operator, Menejer) bitta RBAC roliga (MANAGER) tushishi mumkin,
  // filtr esa foydalanuvchi jadvalda ko'rgan aniq lavozimni ajrata olishi kerak.
  const roleOptions = useMemo(() => {
    const set = new Set(staff.map((u) => u.roleLabel).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((u) => {
      if (roleFilter && u.roleLabel !== roleFilter) return false;
      if (status === "active" && !u.active) return false;
      if (status === "inactive" && u.active) return false;
      if (q && !`${u.name} ${u.phone ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, search, roleFilter, status]);

  const exportCsvNow = () => {
    exportRows(
      tr(locale, { uz: "xodimlar", ru: "сотрудники", en: "staff", de: "mitarbeiter" }),
      [
        { key: "name", label: tr(locale, { uz: "To'liq nomi", ru: "Полное имя", en: "Full name", de: "Vollständiger Name" }) },
        { key: "gender", label: tr(locale, { uz: "Jinsi", ru: "Пол", en: "Gender", de: "Geschlecht" }) },
        { key: "students", label: tr(locale, { uz: "Aktiv o'quvchilar", ru: "Активные ученики", en: "Active students", de: "Aktive Schüler" }) },
        { key: "role", label: tr(locale, { uz: "Turi", ru: "Тип", en: "Type", de: "Typ" }) },
        { key: "branch", label: tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }) },
        { key: "courses", label: tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" }) },
        { key: "status", label: tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" }) },
      ],
      filtered.map((u) => ({
        name: u.name,
        gender: u.gender === "MALE" ? tr(locale, { uz: "Erkak", ru: "Мужской", en: "Male", de: "Männlich" }) : u.gender === "FEMALE" ? tr(locale, { uz: "Ayol", ru: "Женский", en: "Female", de: "Weiblich" }) : "",
        students: u.students,
        role: u.roleLabel,
        branch: u.branch ?? "",
        phone: u.phone ?? "",
        courses: u.courses.join(", "),
        status: u.active ? tr(locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" }) : tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" }),
      })),
    );
  };

  const toggleActive = (id: string) => start(async () => { await toggleStaffActive(id); router.refresh(); });

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Xodimlar", ru: "Сотрудники", en: "Staff", de: "Mitarbeiter" })}</h1>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <button onClick={() => setAddOpen(true)} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Xodim qo'shish", ru: "Добавить сотрудника", en: "Add staff", de: "Mitarbeiter hinzufügen" })}
          </button>
        )}
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search", de: "Suchen" })} className="h-10 w-52 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <Select value={status} onChange={setStatus} placeholder={tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" })} options={[{ v: "active", label: tr(locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" }) }, { v: "inactive", label: tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" }) }]} />
        <Select value={roleFilter} onChange={setRoleFilter} placeholder={tr(locale, { uz: "Vazifa", ru: "Должность", en: "Role", de: "Rolle" })} options={roleOptions.map((r) => ({ v: r, label: r }))} />
        <button onClick={exportCsvNow} className="ml-auto flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60" title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}>
          <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Export" })}
        </button>
      </div>

      {/* Jadval */}
      <div className={cn("overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900", pending && "opacity-70")}>
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni", ru: "Всего", en: "Total", de: "Gesamt" })}: {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(locale, { uz: "To'liq nomi", ru: "Полное имя", en: "Full name", de: "Vollständiger Name" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Jinsi", ru: "Пол", en: "Gender", de: "Geschlecht" })}</th>
                <th className="px-4 py-3 text-center">{tr(locale, { uz: "Aktiv o'quvchilar soni", ru: "Кол-во активных учеников", en: "Active students count", de: "Anzahl aktiver Schüler" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Turi", ru: "Тип", en: "Type", de: "Typ" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Filiallar", ru: "Филиалы", en: "Branches", de: "Filialen" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Telefon raqam", ru: "Номер телефона", en: "Phone number", de: "Telefonnummer" })}</th><th className="px-4 py-3">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })}</th>
                {canManage && <th className="px-4 py-3 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={canManage ? 10 : 9} className="px-4 py-16 text-center">
                  <div className="text-3xl opacity-30">📭</div>
                  <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found", de: "Keine Daten gefunden" })}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter.", de: "Keine Daten gefunden. Versuchen Sie, den Filter zu ändern." })}</p>
                </td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id} onClick={canManage ? () => setDetailId(u.id) : undefined} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50", canManage && "cursor-pointer")}>
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                      {u.name}
                      {!u.active && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700">{tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" })}</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{u.gender === "MALE" ? <span style={{ color: "#3b82f6" }}>♂ {tr(locale, { uz: "Erkak", ru: "Мужской", en: "Male", de: "Männlich" })}</span> : u.gender === "FEMALE" ? <span style={{ color: "#ec4899" }}>♀ {tr(locale, { uz: "Ayol", ru: "Женский", en: "Female", de: "Weiblich" })}</span> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">{u.students || "—"}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">{u.groups.length === 0 ? <span className="text-xs text-slate-400">—</span> : u.groups.map((g) => (
                      <Link key={g.id} href={`/groups/${g.id}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-700/50 dark:text-slate-300">{g.name}</Link>
                    ))}</div>
                  </td>
                  <td className="px-4 py-3"><span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-300">{u.roleLabel}</span></td>
                  <td className="px-4 py-3 text-slate-500">{u.branch ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{u.courses.length ? u.courses.join(", ") : "—"}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleActive(u.id); }}
                          disabled={pending}
                          title={u.active ? tr(locale, { uz: "Nofaol qilish", ru: "Деактивировать", en: "Deactivate", de: "Deaktivieren" }) : tr(locale, { uz: "Faollashtirish", ru: "Активировать", en: "Activate", de: "Aktivieren" })}
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 disabled:opacity-50 dark:text-slate-400"
                        >
                          <span className={cn("relative h-5 w-9 rounded-full transition", u.active ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")}>
                            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", u.active ? "left-4" : "left-0.5")} />
                          </span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && canManage && <StaffForm positions={positions} branches={branches} onClose={() => setAddOpen(false)} locale={locale} />}
      {detailId && canManage && <StaffDetailModal userId={detailId} locale={locale} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function StaffForm({ positions, branches, onClose, locale }: { positions: PosOpt[]; branches: Opt[]; onClose: () => void; locale: Locale }) {
  // Lavozimlarni bo'lim bo'yicha guruhlash (optgroup uchun)
  const posGroups = useMemo(() => {
    const map = new Map<string, PosOpt[]>();
    for (const p of positions) {
      const key = p.department || tr(locale, { uz: "Boshqa", ru: "Другое", en: "Other", de: "Sonstiges" });
      const arr = map.get(key); if (arr) arr.push(p); else map.set(key, [p]);
    }
    return Array.from(map.entries());
  }, [positions, locale]);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<"" | "MALE" | "FEMALE">("");
  const [salaryOn, setSalaryOn] = useState(false);
  const [salaryStr, setSalaryStr] = useState("");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;

  const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:disabled:bg-slate-800/30";
  const lbl = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
  const req = <span className="text-rose-500">*</span>;

  const submit = () => {
    setError(null);
    const fd = new FormData(formRef.current!);
    fd.set("gender", gender);
    fd.set("fiksa", salaryOn ? (salaryStr.replace(/\s/g, "") || "0") : "0");
    start(async () => { const r = await createStaff(fd); if (r.ok) { onClose(); router.refresh(); } else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" })); });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <form ref={formRef} onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[560px] max-w-[95%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Xodim qo'shish", ru: "Добавить сотрудника", en: "Add staff", de: "Mitarbeiter hinzufügen" })}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          {/* Ism / Familiya */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{tr(locale, { uz: "Ism", ru: "Имя", en: "First name", de: "Vorname" })} {req}</label><input name="ism" required placeholder={tr(locale, { uz: "Ism", ru: "Имя", en: "First name", de: "Vorname" })} className={inp} /></div>
            <div><label className={lbl}>{tr(locale, { uz: "Familiya", ru: "Фамилия", en: "Last name", de: "Nachname" })}</label><input name="familiya" placeholder={tr(locale, { uz: "Familiya", ru: "Фамилия", en: "Last name", de: "Nachname" })} className={inp} /></div>
          </div>
          {/* Telefon */}
          <div>
            <label className={lbl}>{tr(locale, { uz: "Telefon raqam", ru: "Номер телефона", en: "Phone number", de: "Telefonnummer" })} {req}</label>
            <div className="flex">
              <span className="flex h-10 items-center gap-1.5 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                <svg viewBox="0 0 30 15" aria-label="UZ" className="h-3 w-6 shrink-0 rounded-[2px] ring-1 ring-black/10">
                  <rect width="30" height="15" fill="#fff" />
                  <rect width="30" height="4.6" fill="#0099b5" />
                  <rect y="10.4" width="30" height="4.6" fill="#1eb53a" />
                  <rect y="4.6" width="30" height="0.5" fill="#ce1126" />
                  <rect y="9.9" width="30" height="0.5" fill="#ce1126" />
                  <circle cx="4" cy="2.3" r="1.5" fill="#fff" />
                  <circle cx="4.7" cy="2.3" r="1.3" fill="#0099b5" />
                  <circle cx="6.6" cy="1.4" r="0.28" fill="#fff" />
                  <circle cx="7.7" cy="1.4" r="0.28" fill="#fff" />
                  <circle cx="6.6" cy="2.3" r="0.28" fill="#fff" />
                  <circle cx="7.7" cy="2.3" r="0.28" fill="#fff" />
                  <circle cx="6.6" cy="3.2" r="0.28" fill="#fff" />
                  <circle cx="7.7" cy="3.2" r="0.28" fill="#fff" />
                </svg>
                +998
              </span>
              <input name="phone" placeholder="90 000 00 00" className={cn(inp, "rounded-l-none")} />
            </div>
          </div>
          {/* Vazifasi / Jinsi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{tr(locale, { uz: "O'quv markazidagi vazifasi", ru: "Должность в учебном центре", en: "Role at the learning center", de: "Rolle im Lernzentrum" })} {req}</label>
              <select name="position" required defaultValue="" className={inp}>
                <option value="" disabled>{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
                {posGroups.map(([dept, items]) => (
                  <optgroup key={dept} label={dept}>
                    {items.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>{tr(locale, { uz: "Jinsi", ru: "Пол", en: "Gender", de: "Geschlecht" })}</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as never)} className={inp}>
                <option value="">{tr(locale, { uz: "Jinsini tanlang", ru: "Выберите пол", en: "Select gender", de: "Geschlecht auswählen" })}</option><option value="MALE">{tr(locale, { uz: "Erkak", ru: "Мужской", en: "Male", de: "Männlich" })}</option><option value="FEMALE">{tr(locale, { uz: "Ayol", ru: "Женский", en: "Female", de: "Weiblich" })}</option>
              </select>
            </div>
          </div>
          {/* Tug'ilgan sana / Filial */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{tr(locale, { uz: "Tug'ilgan sanasi", ru: "Дата рождения", en: "Date of birth", de: "Geburtsdatum" })}</label><input name="birthDate" type="date" className={inp} /></div>
            <div><label className={lbl}>{tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" })}</label><select name="branchId" defaultValue="" className={inp}><option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          </div>

          {/* Ish haqi chiqarish */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]">
            <Switch on={salaryOn} onToggle={() => setSalaryOn((v) => !v)} label={tr(locale, { uz: "Ish haqi chiqarish", ru: "Начислять зарплату", en: "Enable salary", de: "Gehalt aktivieren" })} />
            {salaryOn && (
              <div className="mt-3">
                <label className={lbl}>{tr(locale, { uz: "Ish haqi (oylik, so'm)", ru: "Зарплата (в месяц, сум)", en: "Salary (monthly, UZS)", de: "Gehalt (monatlich, UZS)" })}</label>
                <input inputMode="numeric" value={salaryStr} onChange={(e) => setSalaryStr(e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " "))} placeholder="2 000 000" className={inp} />
              </div>
            )}
          </div>

          {/* Email / Parol */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>{tr(locale, { uz: "Elektron pochta", ru: "Электронная почта", en: "Email", de: "E-Mail" })} {req}</label><input name="email" type="email" required placeholder="example@gmail.com" className={inp} /></div>
            <div><label className={lbl}>{tr(locale, { uz: "Parol (login uchun)", ru: "Пароль (для входа)", en: "Password (for login)", de: "Passwort (für Anmeldung)" })} {req}</label><input name="password" type="text" required placeholder={tr(locale, { uz: "Kamida 4 ta belgi", ru: "Минимум 4 символа", en: "At least 4 characters", de: "Mindestens 4 Zeichen" })} className={inp} /></div>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">{tr(locale, { uz: "Orqaga", ru: "Назад", en: "Back", de: "Zurück" })}</button>
          <button type="button" onClick={submit} disabled={pending} className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
        </div>
      </form>
    </div>, document.body);
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
      <span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-4" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("h-10 appearance-none rounded-lg border bg-white pl-3 pr-8 text-sm outline-none focus:border-brand-400 dark:bg-slate-800 dark:text-slate-100", value ? "border-brand-300 text-slate-800 dark:border-brand-500/40" : "border-slate-200 text-slate-500 dark:border-slate-700")}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
