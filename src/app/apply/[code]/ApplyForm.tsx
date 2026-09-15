"use client";

import { useMemo, useState, useTransition } from "react";
import { submitApplication, type StudyFormat } from "./actions";
import type { ApplyQuestion } from "../../(app)/links/questions";
import { fmtUzPhoneInput } from "@/lib/phone";
import { DEFAULT_COUNTRY_ISO, PHONE_COUNTRIES, localDigitsOk, phoneCountry } from "@/lib/phoneCodes";

/**
 * Ochiq ariza formasi (2026-09-15 talab):
 *   1) Ta'lim shakli — onlayn / oflayn
 *   2) Oflayn → filial tanlash
 *   3) Ism-familiya, telefon (davlat kodi bilan), onlayn → Telegram username
 *   4) Daraja — A1 / A2 / B1 / B2 (Sozlamalar > Darajalar ro'yxatidan)
 *   + havolaga biriktirilgan qo'shimcha savollar (bo'lsa)
 */
export default function ApplyForm({ code, preview, questions = [], levels, branches }: {
  code: string;
  preview: boolean;
  /** Havola yaratishda belgilangan qo'shimcha savollar (bo'lmasa — faqat asosiy maydonlar) */
  questions?: ApplyQuestion[];
  /** Sozlamalar > Darajalar katalogidagi kodlar */
  levels: string[];
  /** Faol filiallar — oflayn ta'lim uchun */
  branches: { id: string; name: string; address: string | null }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [format, setFormat] = useState<StudyFormat | null>(null);
  const [branchId, setBranchId] = useState("");
  const [fullName, setName] = useState("");
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [level, setLevel] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));

  const country = useMemo(() => phoneCountry(countryIso), [countryIso]);
  const setAnswer = (i: number, v: string) => setAnswers((a) => a.map((x, k) => (k === i ? v : x)));

  // O'zbekiston uchun "XX XXX XX XX" maskasi, boshqa davlatlar uchun faqat raqamlar
  const onPhone = (v: string) => setPhone(countryIso === "UZ" ? fmtUzPhoneInput(v) : v.replace(/\D/g, "").slice(0, 12));
  const onCountry = (iso: string) => { setCountryIso(iso); setPhone(""); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setError(null);

    if (!format) { setError("Ta'lim shaklini tanlang"); return; }
    if (format === "OFFLINE" && !branchId) { setError("Filialni tanlang"); return; }
    if (fullName.trim().length < 2) { setError("Ismingizni kiriting"); return; }
    if (!localDigitsOk(countryIso, phone.replace(/\D/g, ""))) {
      setError(countryIso === "UZ" ? "Telefon raqamini to'liq kiriting: +998 XX XXX XX XX" : `Telefon raqamini to'g'ri kiriting (${country.code} ...)`);
      return;
    }
    if (!level) { setError("Darajangizni tanlang"); return; }

    // Majburiy savollar tekshiruvi (serverda ham qayta tekshiriladi)
    const missing = questions.findIndex((q, i) => q.required && !answers[i]?.trim());
    if (missing >= 0) { setError(`"${questions[missing].q}" — javob berilishi shart`); return; }

    start(async () => {
      const r = await submitApplication(code, fullName, `${country.code} ${phone}`, answers, {
        format, branchId: format === "OFFLINE" ? branchId : undefined, telegram: format === "ONLINE" ? telegram : undefined, countryIso, level,
      });
      if (r.ok) setDone(true);
      else setError(r.error ?? "Xatolik");
    });
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mb-1 text-4xl">✅</div>
        <div className="text-lg font-bold text-emerald-700">Arizangiz qabul qilindi!</div>
        <p className="mt-1 text-sm text-emerald-600">Tez orada siz bilan bog&apos;lanamiz.</p>
      </div>
    );
  }

  const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-brand-500";
  const chip = (on: boolean) =>
    `flex cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-3 text-sm font-semibold transition active:scale-[0.98] ${
      on ? "border-brand-600 bg-brand-600 text-white shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50"
    }`;

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* 1) Ta'lim shakli */}
      <div>
        <span className="mb-1.5 block text-xs font-semibold text-slate-500">Ta&apos;lim shakli <span className="text-rose-500">*</span></span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setFormat("ONLINE")} className={chip(format === "ONLINE")}>
            <span className="mr-1.5">💻</span> Onlayn
          </button>
          <button type="button" onClick={() => setFormat("OFFLINE")} className={chip(format === "OFFLINE")}>
            <span className="mr-1.5">🏫</span> Oflayn
          </button>
        </div>
      </div>

      {/* 2) Oflayn — filial */}
      {format === "OFFLINE" && (
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-500">Filial <span className="text-rose-500">*</span></span>
          {branches.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Hozircha faol filial yo&apos;q — onlayn shaklni tanlang.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {branches.map((b) => (
                <button key={b.id} type="button" onClick={() => setBranchId(b.id)} className={`${chip(branchId === b.id)} flex-col gap-0.5 py-2.5`}>
                  <span>{b.name}</span>
                  {b.address && <span className={`text-[11px] font-normal ${branchId === b.id ? "text-white/80" : "text-slate-400"}`}>{b.address}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3) Shaxsiy ma'lumotlar — shakl tanlangach */}
      {format && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Ism va familiya <span className="text-rose-500">*</span></span>
            <input value={fullName} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Ism Familiya" className={inp} />
          </label>

          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Telefon raqami <span className="text-rose-500">*</span></span>
            <div className="flex items-center rounded-lg border border-slate-300 pr-3 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              {/* Davlat kodi — MDH va Yevropa ro'yxati; standart O'zbekiston */}
              <select
                value={countryIso}
                onChange={(e) => onCountry(e.target.value)}
                aria-label="Davlat kodi"
                className="h-11 max-w-[128px] shrink-0 cursor-pointer rounded-l-lg border-r border-slate-200 bg-slate-50 pl-2 pr-1 text-sm font-medium text-slate-700 outline-none"
              >
                <optgroup label="MDH">
                  {PHONE_COUNTRIES.filter((c) => c.group === "cis").map((c) => (
                    <option key={c.iso} value={c.iso}>{c.flag} {c.code} {c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Yevropa">
                  {PHONE_COUNTRIES.filter((c) => c.group === "eu").map((c) => (
                    <option key={c.iso} value={c.iso}>{c.flag} {c.code} {c.name}</option>
                  ))}
                </optgroup>
              </select>
              <span className="ml-2 select-none font-medium text-slate-500">{country.code}</span>
              <input
                value={phone}
                onChange={(e) => onPhone(e.target.value)}
                required
                placeholder={countryIso === "UZ" ? "90 123 45 67" : "raqam"}
                inputMode="numeric"
                autoComplete="tel-national"
                className="ml-2 h-11 w-full flex-1 bg-transparent outline-none"
              />
            </div>
          </div>

          {format === "ONLINE" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Telegram username</span>
              <div className="flex items-center rounded-lg border border-slate-300 px-3 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <span className="select-none font-medium text-slate-500">@</span>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value.replace(/^@+/, "").replace(/\s/g, ""))}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="ml-1.5 h-11 w-full flex-1 bg-transparent outline-none"
                />
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">Onlayn darslar va materiallar Telegram orqali yuboriladi</span>
            </label>
          )}

          {/* 4) Daraja */}
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">Darajangiz <span className="text-rose-500">*</span></span>
            <div className="grid grid-cols-4 gap-2">
              {levels.map((l) => (
                <button key={l} type="button" onClick={() => setLevel(l)} className={`${chip(level === l)} py-2.5`}>{l}</button>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-slate-400">Bilmasangiz — A1 ni tanlang, darajani birga aniqlaymiz</span>
          </div>

          {/* Qo'shimcha savollar — yoziladigan yoki variantli */}
          {questions.map((q, i) => (
            <div key={i} className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                {q.q}
                {q.required && <span className="text-rose-500"> *</span>}
              </span>

              {q.type === "choice" ? (
                <div className="space-y-1.5">
                  {(q.options ?? []).map((opt) => (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${
                        answers[i] === opt
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q${i}`}
                        checked={answers[i] === opt}
                        onChange={() => setAnswer(i, opt)}
                        className="h-4 w-4 accent-brand-600"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswer(i, e.target.value)}
                  required={q.required}
                  placeholder="Javobingiz"
                  className={inp}
                />
              )}
            </div>
          ))}
        </>
      )}

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
      <button type="submit" disabled={pending || preview || !format} className="h-11 w-full rounded-lg bg-brand-600 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
        {preview ? "Ko'rib chiqish rejimi" : pending ? "Yuborilmoqda..." : "Ariza yuborish"}
      </button>
    </form>
  );
}
