"use client";

import { useState, useTransition } from "react";
import { planPriceLabel, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { submitSalesLead } from "./actions";

const FEATURES = [
  { title: "Lidlar va CRM", text: "Arizalar, qo'ng'iroqlar va kanban bitta joyda" },
  { title: "O'quvchilar va guruhlar", text: "Jadval, xonalar, o'qituvchilar va filiallar" },
  { title: "Davomat jurnali", text: "Har oy uchun guruh va o'quvchi jurnali" },
  { title: "To'lov va qarzdorlik", text: "Kim qancha to'lagani va kim qarzdorligi darhol ko'rinadi" },
  { title: "Moliya va oylik", text: "Xarajatlar, tushum va o'qituvchilar oyligi hisobi" },
  { title: "Alohida baza", text: "Har markazga o'z manzili va o'z ma'lumotlar bazasi" },
];

const ERRORS: Record<string, string> = {
  center: "Markaz nomini kiriting",
  contact: "Ismingizni kiriting",
  phone: "Telefon raqamini to'g'ri kiriting",
  too_many: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring",
  closed: "Bu havola endi faol emas",
  full: "Ariza qabul qilinmadi. Keyinroq urinib ko'ring",
};

const limitLabel = (n: number | null, unit: string) => {
  if (!n) return `Cheksiz ${unit}`;
  if (n === 1) return `1 ta ${unit}`;
  return `${n.toLocaleString("ru-RU").replace(/[,  ]/g, " ")} tagacha ${unit}`;
};

export default function Landing({ code, plans }: { code: string; plans: SalesPlan[] }) {
  const [f, setF] = useState({ centerName: "", contactName: "", phone: "", city: "", students: "", planId: "", message: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const choose = (id: string) => {
    set("planId", id);
    document.getElementById("ariza")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await submitSalesLead(code, f);
      if (r.ok) setDone(true);
      else setError(ERRORS[r.error ?? ""] ?? "Ariza yuborilmadi. Qayta urinib ko'ring");
    });
  };

  const fld = "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-slate-500 outline-none transition focus:border-orange-400/60 focus:bg-white/[0.07]";
  const lbl = "mb-1.5 block text-xs font-semibold text-slate-400";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <header className="flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.png" alt="Germaniya Live" className="h-10 w-auto object-contain" />
        <a href="#ariza" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-orange-400/50">Ariza qoldirish</a>
      </header>

      <section className="py-12 text-center md:py-20">
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight text-white md:text-5xl">
          O'quv markazingizni <span className="bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] bg-clip-text text-transparent">bitta tizimda</span> boshqaring
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400 md:text-lg">
          Lidlar, guruhlar, davomat, to'lovlar va oylik hisobi uchun tayyor CRM. Oylik obuna asosida ishlaydi, o'rnatish bizdan.
        </p>
        <a href="#ariza" className="mt-8 inline-flex h-12 items-center rounded-xl bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-8 text-[15px] font-bold text-white shadow-lg shadow-orange-600/25 transition hover:brightness-110">
          Demo so'rash
        </a>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((it) => (
          <div key={it.title} className="rounded-2xl border border-white/[0.07] bg-[#0d1424]/80 p-5">
            <div className="text-[15px] font-bold text-white">{it.title}</div>
            <p className="mt-1.5 text-sm text-slate-400">{it.text}</p>
          </div>
        ))}
      </section>

      {plans.length > 0 && (
        <section className="pt-14 md:pt-20">
          <h2 className="text-center text-2xl font-extrabold text-white md:text-3xl">Oylik obuna narxlari</h2>
          <div className="mt-8 grid items-stretch gap-5 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className={`relative flex flex-col rounded-2xl border bg-[#0d1424]/80 p-6 ${p.popular ? "border-orange-400/60 shadow-xl shadow-orange-900/20" : "border-white/[0.07]"}`}>
                {p.popular && <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-[#e3262b] to-[#f6b51e] px-3 py-1 text-[11px] font-bold text-white">Ko'p tanlanadi</span>}
                <div className="text-lg font-bold text-white">{p.name}</div>
                <div className="mt-3 text-2xl font-extrabold tabular-nums text-white">{planPriceLabel(p.price)}</div>
                {!!p.price && <div className="text-xs text-slate-500">oyiga</div>}
                <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
                  <li>{limitLabel(p.students, "o'quvchi")}</li>
                  <li>{limitLabel(p.branches, "filial")}</li>
                  {p.features.map((x) => <li key={x}>{x}</li>)}
                </ul>
                <button type="button" onClick={() => choose(p.id)} className="mt-6 h-11 rounded-xl border border-white/10 text-sm font-bold text-white transition hover:border-orange-400/60 hover:bg-white/[0.04]">
                  Tanlash
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="ariza" className="mx-auto max-w-2xl scroll-mt-6 pt-14 md:pt-20">
        <h2 className="text-center text-2xl font-extrabold text-white md:text-3xl">Ariza qoldiring</h2>
        <p className="mt-2 text-center text-sm text-slate-400">Siz bilan bog'lanib, tizimni ko'rsatib beramiz.</p>
        {done ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
            <div className="text-lg font-bold text-emerald-300">Arizangiz qabul qilindi</div>
            <p className="mt-1.5 text-sm text-slate-300">Tez orada ko'rsatgan raqamingizga qo'ng'iroq qilamiz.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-[#0d1424]/80 p-6 shadow-2xl shadow-black/40">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={lbl}>O'quv markazi nomi *</label><input required value={f.centerName} onChange={(e) => set("centerName", e.target.value)} className={fld} /></div>
              <div><label className={lbl}>Ismingiz *</label><input required value={f.contactName} onChange={(e) => set("contactName", e.target.value)} className={fld} /></div>
              <div><label className={lbl}>Telefon *</label><input required type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={fld} /></div>
              <div><label className={lbl}>Shahar</label><input value={f.city} onChange={(e) => set("city", e.target.value)} className={fld} /></div>
              <div><label className={lbl}>O'quvchilar soni</label><input inputMode="numeric" value={f.students} onChange={(e) => set("students", e.target.value.replace(/\D/g, "").slice(0, 6))} className={fld} /></div>
              <div>
                <label className={lbl}>Tarif</label>
                <select value={f.planId} onChange={(e) => set("planId", e.target.value)} className={fld}>
                  <option value="" className="bg-[#0d1424]">Hali tanlamadim</option>
                  {plans.map((p) => <option key={p.id} value={p.id} className="bg-[#0d1424]">{p.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className={lbl}>Izoh</label><textarea rows={3} value={f.message} onChange={(e) => set("message", e.target.value)} className={`${fld} h-auto py-3`} /></div>
            <input aria-hidden tabIndex={-1} autoComplete="off" name="website" value={f.website} onChange={(e) => set("website", e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</p>}
            <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] text-[15px] font-bold text-white shadow-lg shadow-orange-600/25 transition hover:brightness-110 disabled:opacity-60">
              {pending ? "Yuborilmoqda..." : "Ariza yuborish"}
            </button>
          </form>
        )}
      </section>

      <footer className="pt-12 text-center text-xs text-slate-600">Germaniya Live CRM</footer>
    </div>
  );
}
