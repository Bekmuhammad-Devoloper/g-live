"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "../_components/Icon";
import { type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { fmtUzPhoneInput } from "@/lib/phone";
import { createTeacher } from "./teacherActions";

export interface BranchOption { id: string; name: string }

export default function NewTeacherForm({ branches, locale, onClose }: { branches: BranchOption[]; locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE");
  const [fiksaStr, setFiksaStr] = useState("");
  const [kpiStr, setKpiStr] = useState("200 000");

  const groupDigits = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fmtMoney = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 12); return d ? groupDigits(d) : ""; };
  // +998 doimiy prefiks; foydalanuvchi faqat qolgan 9 raqamni kiritadi (src/lib/phone.ts)
  const fmtPhone = fmtUzPhoneInput;
  function onFiksaChange(v: string) { setFiksaStr(fmtMoney(v)); }
  function onKpiChange(v: string) { setKpiStr(fmtMoney(v)); }
  function onPhoneChange(v: string) { setPhone(fmtPhone(v)); }

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function submit() {
    setError(null);
    const fiksa = Number(fiksaStr.replace(/\s/g, "")) || 0;
    const kpiBonus = Number(kpiStr.replace(/\s/g, "")) || 0;
    const phoneFull = phone.trim() ? "+998 " + phone.trim() : undefined;
    start(async () => {
      const res = await createTeacher({ fullName, email, phone: phoneFull, password, branchId: branchId || undefined, fiksa, kpiBonus, gender });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
            <Icon name="personPlus" className="text-brand-500" style={{ height: 18, width: 18 }} />
            {tr(locale, { uz: "Yangi o'qituvchi qo'shish", ru: "Добавить преподавателя", en: "Add teacher" })}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        {/* Form (scroll) */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <Field label={tr(locale, { uz: "Ism-familiya *", ru: "Имя-фамилия *", en: "Full name *" })} value={fullName} onChange={setFullName} placeholder={tr(locale, { uz: "Masalan: Nigora Rashidova", ru: "Например: Нигора Рашидова", en: "e.g. Nigora Rashidova" })} autoFocus />

          {/* Jinsi */}
          <div>
            <span className="mb-1 block text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Jinsi", ru: "Пол", en: "Gender" })}</span>
            <div className="grid grid-cols-2 gap-2">
              <GenderBtn active={gender === "MALE"} onClick={() => setGender("MALE")} icon="♂" label={tr(locale, { uz: "Erkak", ru: "Мужчина", en: "Male" })} color="#3b82f6" />
              <GenderBtn active={gender === "FEMALE"} onClick={() => setGender("FEMALE")} icon="♀" label={tr(locale, { uz: "Ayol", ru: "Женщина", en: "Female" })} color="#ec4899" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" })}</span>
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 transition focus-within:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="select-none text-sm font-medium text-slate-500 dark:text-slate-400">+998</span>
                <input value={phone} onChange={(e) => onPhoneChange(e.target.value)} inputMode="numeric" placeholder="90 123 45 67" className="ml-2 h-full w-full flex-1 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
              </div>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch" })}</span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
              >
                <option value="">{tr(locale, { uz: "— tanlanmagan —", ru: "— не выбрано —", en: "— not selected —" })}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <Field label={tr(locale, { uz: "Email * (login uchun)", ru: "Email * (для входа)", en: "Email * (for login)" })} value={email} onChange={setEmail} placeholder="teacher@gl.uz" type="email" />
          <Field label={tr(locale, { uz: "Parol *", ru: "Пароль *", en: "Password *" })} value={password} onChange={setPassword} placeholder={tr(locale, { uz: "Kamida 4 ta belgi", ru: "Минимум 4 символа", en: "At least 4 characters" })} type="text" />
          <div>
            <span className="mb-1 block text-[11px] font-medium text-slate-400">{tr(locale, { uz: "Fiksa (belgilangan oylik maosh)", ru: "Фикса (фиксированная зарплата)", en: "Base (fixed monthly salary)" })}</span>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={fiksaStr}
                onChange={(e) => onFiksaChange(e.target.value)}
                placeholder="0"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-12 text-sm font-semibold text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                style={{ borderLeft: "3px solid #3b82f6" }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">{tr(locale, { uz: "so'm", ru: "сум", en: "so'm" })}</span>
            </div>
          </div>

          {/* KPI bonusi */}
          <div>
            <span className="mb-1 block text-[11px] font-medium text-slate-400">{tr(locale, { uz: "KPI bonusi (so'm)", ru: "KPI бонус (сум)", en: "KPI bonus (so'm)" })}</span>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={kpiStr}
                onChange={(e) => onKpiChange(e.target.value)}
                placeholder="200 000"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-12 text-sm font-semibold text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                style={{ borderLeft: "3px solid #10b981" }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">{tr(locale, { uz: "so'm", ru: "сум", en: "so'm" })}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              <Icon name="info" className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="flex-[1.4] rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? tr(locale, { uz: "Qo'shilmoqda...", ru: "Добавление...", en: "Adding..." }) : tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add" })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function GenderBtn({ active, onClick, icon, label, color }: { active: boolean; onClick: () => void; icon: string; label: string; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition ${active ? "text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"}`}
      style={active ? { background: color, borderColor: color } : undefined}
    >
      <span className="text-base leading-none">{icon}</span> {label}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
      />
    </label>
  );
}
