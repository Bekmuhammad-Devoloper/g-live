"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../_components/Icon";
import { confirmDelete } from "../_components/dialogs";
import { StaffForm, type PosOpt } from "../users/UsersView";
import { deleteStaffPermanent, getStaffDetail, type StaffDetail } from "../users/actions";
import { groupColor } from "../groups/groupColor";
import SalaryModal from "./SalaryModal";
import { colorFor } from "./TeacherCard";
import type { VTeacher } from "./TeachersView";

// O'qituvchi tafsilotlari — kartadagi ism bosilganda ochiladi.
// Ichida: aloqa ma'lumotlari, guruhlari (har biri guruh sahifasiga olib boradi),
// maosh boshqaruvi (rahbariyat), tahrirlash va butunlay o'chirish.
// Tahrirlash formasi Xodimlar bo'limidagi StaffForm — bitta forma, bitta qoida.

export default function TeacherDrawer({
  teacher: t, locale, canManage, canEdit, canDelete, positions, branches, onClose,
}: {
  teacher: VTeacher;
  locale: Locale;
  /** Maosh va kirish ma'lumotlari (direktor, o'rinbosar) */
  canManage: boolean;
  /** Tahrirlash (direktor, o'rinbosar, administrator) */
  canEdit: boolean;
  /** Butunlay o'chirish (direktor; administrator — o'z filialida) */
  canDelete: boolean;
  positions: PosOpt[];
  branches: { id: string; name: string }[];
  onClose: () => void;
}) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [edit, setEdit] = useState<StaffDetail | null>(null);
  const [loadingEdit, startLoad] = useTransition();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const color = colorFor(t.fullName);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !edit && !salaryOpen) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, edit, salaryOpen]);

  if (!mounted) return null;

  const openEdit = () => startLoad(async () => {
    const r = await getStaffDetail(t.id);
    if (r.ok && r.data) setEdit(r.data);
    else setError(T("Ma'lumot yuklanmadi", "Данные не загрузились", "Could not load details", "Daten konnten nicht geladen werden"));
  });

  const remove = async () => {
    const ok = await confirmDelete({
      title: T("O'qituvchini butunlay o'chirish", "Удалить преподавателя навсегда", "Delete teacher permanently", "Lehrkraft endgültig löschen"),
      message: T(
        `${t.fullName} tizimdan o'chiriladi: logini ishlamay qoladi, ${t.groups.length} ta guruhi ustozsiz qoladi (guruhlar o'zi saqlanadi). Bu amalni qaytarib bo'lmaydi.`,
        `${t.fullName} будет удалён из системы: логин перестанет работать, ${t.groups.length} групп(ы) останутся без преподавателя (сами группы сохраняются). Это действие необратимо.`,
        `${t.fullName} will be removed: the login stops working, ${t.groups.length} group(s) lose their teacher (groups themselves are kept). This cannot be undone.`,
        `${t.fullName} wird entfernt: Login funktioniert nicht mehr, ${t.groups.length} Gruppe(n) verlieren die Lehrkraft (Gruppen bleiben). Nicht rückgängig zu machen.`,
      ),
      confirmLabel: T("Ha, butunlay o'chirish", "Да, удалить навсегда", "Yes, delete permanently", "Ja, endgültig löschen"),
    });
    if (!ok) return;
    setError(null);
    start(async () => {
      const r = await deleteStaffPermanent(t.id);
      if (r.ok) { onClose(); router.refresh(); } else setError(r.error ?? T("Xatolik", "Ошибка", "Error", "Fehler"));
    });
  };

  const row = "flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0 dark:border-white/5";

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
        <div onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full drawer-panel flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
          {/* Sarlavha */}
          <div className="relative shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/10">
            <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}14, transparent 60%)` }} />
            <div className="relative flex items-start justify-between gap-3 px-5 py-5">
              <div className="flex min-w-0 items-center gap-3.5">
                {t.imageUrl ? (
                  <span className="h-14 w-14 shrink-0 rounded-full bg-cover bg-center ring-2 ring-white dark:ring-white/10" style={{ backgroundImage: `url(${t.imageUrl})` }} />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-2 ring-white dark:ring-white/10" style={{ color, background: `${color}24` }}>
                    <Icon name="user" className="h-7 w-7" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="break-words text-lg font-bold leading-tight text-slate-900 dark:text-slate-100">{t.fullName}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-300">{T("O'qituvchi", "Преподаватель", "Teacher", "Lehrkraft")}</span>
                    {t.branch && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">{t.branch}</span>}
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", t.active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-200 text-slate-500 dark:bg-white/10")}>
                      {t.active ? T("Faol", "Активен", "Active", "Aktiv") : T("Nofaol", "Неактивен", "Inactive", "Inaktiv")}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* Aloqa */}
            <Section icon="phone" title={T("Aloqa", "Контакты", "Contact", "Kontakt")}>
              <div className={row}><span className="shrink-0 text-xs text-slate-400">{T("Telefon", "Телефон", "Phone", "Telefon")}</span><span className="text-right text-sm font-medium text-slate-700 dark:text-slate-200">{t.phone ?? "—"}</span></div>
              <div className={row}><span className="shrink-0 text-xs text-slate-400">Email / login</span><span className="min-w-0 break-all text-right text-sm font-medium text-slate-700 dark:text-slate-200">{t.email ?? "—"}</span></div>
              <div className={row}><span className="shrink-0 text-xs text-slate-400">{T("Jinsi", "Пол", "Gender", "Geschlecht")}</span><span className="text-right text-sm font-medium text-slate-700 dark:text-slate-200">{t.gender === "MALE" ? T("Erkak", "Мужчина", "Male", "Männlich") : t.gender === "FEMALE" ? T("Ayol", "Женщина", "Female", "Weiblich") : "—"}</span></div>
            </Section>

            {/* Ko'rsatkichlar */}
            <div className="grid grid-cols-3 gap-2">
              <Stat label={T("Guruh", "Группы", "Groups", "Gruppen")} value={t.groups.length} />
              <Stat label={T("O'quvchi", "Ученики", "Students", "Schüler")} value={t.totalStudents} />
              <Stat label={T("Dars", "Занятия", "Lessons", "Unterrichte")} value={t.totalLessons} />
            </div>

            {/* Guruhlar */}
            <Section icon="layers" title={`${T("Guruhlari", "Группы", "Groups", "Gruppen")} · ${t.groups.length}`}>
              {t.groups.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-white/10">{T("Guruh biriktirilmagan", "Группы не назначены", "No groups assigned", "Keine Gruppen zugewiesen")}</p>
              ) : (
                <div className="space-y-1.5">
                  {t.groups.map((g) => (
                    <Link key={g.id} href={`/groups/${g.id}`} onClick={onClose} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10 dark:hover:bg-white/5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: groupColor(g.id, g.color) }} />
                        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{g.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{g.students} {T("o'quvchi", "уч.", "students", "Schüler")} · {g.lessons} {T("dars", "зан.", "lessons", "Std.")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            {/* Maosh */}
            <Section icon="wallet" title={T("Bu oy maosh", "Зарплата за месяц", "This month salary", "Gehalt diesen Monat")}>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{formatMoney(t.monthTotal, locale)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{T("Fiksa", "Фикса", "Base", "Fixgehalt")} {formatMoney(t.fiksa, locale)}{t.kpi > 0 ? ` · KPI +${formatMoney(t.kpi, locale)}` : ""}</div>
                </div>
                <button type="button" onClick={() => setSalaryOpen(true)} className="shrink-0 rounded-lg border border-amber-300 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-300">
                  {canManage ? T("Boshqarish", "Управление", "Manage", "Verwalten") : T("Tarix", "История", "History", "Verlauf")}
                </button>
              </div>
            </Section>

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
          </div>

          {/* Amallar */}
          {(canEdit || canDelete) && (
            <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
              {canDelete && (
                <button type="button" onClick={remove} disabled={pending} title={T("Butunlay o'chirish", "Удалить навсегда", "Delete permanently", "Endgültig löschen")} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={openEdit} disabled={loadingEdit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
                  <Icon name="pencil" className="h-4 w-4" /> {loadingEdit ? "…" : T("Tahrirlash", "Редактировать", "Edit", "Bearbeiten")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {salaryOpen && <SalaryModal teacher={t} canManage={canManage} locale={locale} onClose={() => setSalaryOpen(false)} />}
      {edit && (
        <StaffForm
          positions={positions}
          branches={branches}
          edit={edit}
          canDelete={canDelete}
          locale={locale}
          onClose={() => { setEdit(null); router.refresh(); }}
        />
      )}
    </>,
    document.body,
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center dark:bg-white/[0.04]">
      <div className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">{value}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
