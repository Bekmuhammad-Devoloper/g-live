"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "../_components/Icon";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import type { VTeacher } from "./TeachersView";
import SalaryModal from "./SalaryModal";
import { setTeacherImage } from "./teacherActions";
import { groupColor } from "../groups/groupColor";

const PALETTE = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4", "#ec4899"];
export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
// ixcham raqam (birliksiz): 3000000 -> "3 000 000"
const nf = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function TeacherCard({ teacher: t, maxStudents, canManage, locale }: { teacher: VTeacher; maxStudents: number; canManage: boolean; locale: Locale }) {
  const color = colorFor(t.fullName);
  const load = maxStudents > 0 ? Math.round((t.totalStudents / maxStudents) * 100) : 0;
  const [salaryOpen, setSalaryOpen] = useState(false);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 220, scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const url = c.toDataURL("image/jpeg", 0.82);
        startUpload(async () => { const r = await setTeacherImage(t.id, url); if (r.ok) router.refresh(); });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#ffffff] p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft dark:border-white/[0.07] dark:bg-[#15243d]">
      {/* Avatar + ism */}
      <div className="flex items-start gap-3">
        <div className="group/av relative h-14 w-14 shrink-0">
          {t.imageUrl ? (
            <span className="block h-14 w-14 overflow-hidden rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${t.imageUrl})`, boxShadow: `inset 0 0 0 2px ${color}` }} />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ color, background: `${color}1f`, boxShadow: `inset 0 0 0 2px ${color}` }}>
              <Icon name="user" className="h-7 w-7" />
            </span>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title={t.imageUrl ? tr(locale, { uz: "Rasmni almashtirish", ru: "Заменить фото", en: "Change photo", de: "Foto ändern" }) : tr(locale, { uz: "Rasm yuklash", ru: "Загрузить фото", en: "Upload photo", de: "Foto hochladen" })}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition group-hover/av:opacity-100 disabled:opacity-100"
              >
                {uploading ? <Icon name="refresh" className="h-5 w-5 animate-spin" /> : <Icon name="camera" className="h-5 w-5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span title={t.fullName} className="min-w-0 break-words font-semibold leading-tight text-slate-800 line-clamp-2 dark:text-slate-100">{t.fullName}</span>
            {t.gender && (
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none"
                title={t.gender === "MALE" ? tr(locale, { uz: "Erkak", ru: "Мужчина", en: "Male", de: "Männlich" }) : tr(locale, { uz: "Ayol", ru: "Женщина", en: "Female", de: "Weiblich" })}
                style={t.gender === "MALE" ? { color: "#3b82f6", background: "#3b82f61a" } : { color: "#ec4899", background: "#ec48991a" }}
              >
                {t.gender === "MALE" ? "♂" : "♀"}
              </span>
            )}
            {t.active ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title={tr(locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" })} />
            ) : (
              <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" title={tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" })} />
            )}
          </div>
          {t.phone && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300">
              <Icon name="phone" className="h-3.5 w-3.5" style={{ color: "#10b981" }} /> {t.phone}
            </div>
          )}
          {t.branch && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Icon name="building" className="h-3 w-3" /> {t.branch}
            </div>
          )}
        </div>
      </div>

      {/* Statistika */}
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.03]">
        <Stat icon="layers" value={t.groups.length} label={tr(locale, { uz: "Guruh", ru: "Группы", en: "Groups", de: "Gruppen" })} color="#3b82f6" />
        <Stat icon="graduation" value={t.totalStudents} label={tr(locale, { uz: "O'quvchi", ru: "Ученики", en: "Students", de: "Schüler" })} color="#10b981" />
        <Stat icon="check" value={t.totalLessons} label={tr(locale, { uz: "Dars", ru: "Занятия", en: "Lessons", de: "Unterricht" })} color="#8b5cf6" />
      </div>

      {/* Guruh chiplari */}
      {t.groups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-brand-950/50">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: groupColor(g.id, g.color) }} />
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {/* Yuklama */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>{tr(locale, { uz: "Yuklama", ru: "Нагрузка", en: "Workload", de: "Arbeitslast" })}</span>
          <span className="font-semibold" style={{ color }}>{load}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
          <div className="h-full rounded-full transition-all" style={{ width: `${load}%`, background: color }} />
        </div>
      </div>

      {/* Maosh */}
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Icon name="wallet" className="h-3.5 w-3.5 text-amber-500" /> {tr(locale, { uz: "Bu oy", ru: "Этот месяц", en: "This month", de: "Diesen Monat" })}
          </div>
          <div className="flex items-center gap-1.5">
            {t.kpi > 0 && (
              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ color: "#8b5cf6", background: "#8b5cf61a" }}>KPI +{nf(t.kpi)}</span>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-end justify-between">
          <span className="text-lg font-extrabold text-slate-900 dark:text-white">{formatMoney(t.monthTotal, locale)}</span>
          <button
            onClick={() => setSalaryOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-brand-300"
          >
            <Icon name="history" className="h-3 w-3" /> {canManage ? tr(locale, { uz: "Boshqarish", ru: "Управление", en: "Manage", de: "Verwalten" }) : tr(locale, { uz: "Tarix", ru: "История", en: "History", de: "Verlauf" })}
          </button>
        </div>
        {(t.bonus > 0 || t.penalty > 0 || t.kpi > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
            <span className="text-slate-400">{tr(locale, { uz: "Fiksa", ru: "Фикса", en: "Base", de: "Fixgehalt" })} {formatMoney(t.fiksa, locale)}</span>
            {t.bonus > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{formatMoney(t.bonus, locale)}</span>}
            {t.kpi > 0 && <span className="text-violet-600 dark:text-violet-400">KPI +{formatMoney(t.kpi, locale)}</span>}
            {t.penalty > 0 && <span className="text-rose-500">−{formatMoney(t.penalty, locale)}</span>}
          </div>
        )}
      </div>

      {salaryOpen && <SalaryModal teacher={t} canManage={canManage} locale={locale} onClose={() => setSalaryOpen(false)} />}
    </div>
  );
}

function Stat({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon name={icon} className="h-4 w-4" style={{ color }} />
      <span className="text-base font-bold text-slate-800 dark:text-slate-100">{value}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
