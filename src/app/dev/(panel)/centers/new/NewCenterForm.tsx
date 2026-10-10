"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createCenterAction, type CreateResult } from "../../../actions";

type Mod = { key: string; name: string; desc: string };

const translit = (s: string) =>
  s.toLowerCase()
    .replace(/o['ʻ‘’`]/g, "o").replace(/g['ʻ‘’`]/g, "g").replace(/sh/g, "sh").replace(/ch/g, "ch")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 31);

const genPass = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(12); crypto.getRandomValues(a);
  return Array.from(a, (x) => c[x % c.length]).join("");
};

export default function NewCenterForm({ baseDomain, modules }: { baseDomain: string; modules: Mod[] }) {
  const [f, setF] = useState({
    name: "", slug: "", directorName: "", directorEmail: "", directorPhone: "", directorPassword: genPass(),
    months: 1, plan: "Standart", contactName: "", contactPhone: "", notes: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  // Telefoniya alohida trunk talab qiladi — standart holatda o'chiq
  const [mods, setMods] = useState<Set<string>>(new Set(modules.map((m) => m.key).filter((k) => k !== "telephony")));
  const [pending, start] = useTransition();
  const [res, setRes] = useState<CreateResult | null>(null);

  const set = (k: keyof typeof f, v: string | number) => setF((p) => {
    const n = { ...p, [k]: v };
    if (k === "name" && !slugTouched) n.slug = translit(String(v));
    return n;
  });
  const fld = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900";
  const lbl = "mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300";

  const submit = () => {
    setRes(null);
    start(async () => setRes(await createCenterAction({ ...f, modules: [...mods] })));
  };

  if (res?.steps && (res.ok || res.slug)) {
    return (
      <div className="mt-6 space-y-4">
        <div className={`rounded-2xl border p-5 ${res.ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"}`}>
          <h2 className="text-lg font-bold">{res.ok ? "Markaz tayyor" : "Markaz yaratishda xato"}</h2>
          {res.error && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{res.error}</p>}
          <ul className="mt-3 space-y-1.5 text-sm">
            {res.steps.map((s, i) => (
              <li key={i}>
                <span className={s.ok ? "text-emerald-600" : "text-red-600"}>{s.ok ? "✓" : "✕"}</span> {s.step}
                {s.detail && <div className="ml-5 text-xs text-slate-500">{s.detail}</div>}
              </li>
            ))}
          </ul>
        </div>
        {res.ok && res.director && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold">Markazga topshiriladigan ma'lumotlar</h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-slate-500">Manzil</dt><dd><a href={res.url} target="_blank" className="font-mono font-semibold underline">{res.url}</a></dd>
              <dt className="text-slate-500">Direktor login</dt><dd className="font-mono">{res.director.email}</dd>
              <dt className="text-slate-500">Parol</dt><dd className="font-mono font-semibold">{res.director.password}</dd>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Parolni hozir nusxalab oling — u boshqa ko'rsatilmaydi. Kerak bo'lsa markaz sahifasidan yangisini yaratish mumkin.</p>
          </div>
        )}
        <div className="flex gap-2">
          {res.slug && <Link href={`/dev/centers/${res.slug}`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Markaz sahifasi</Link>}
          <Link href="/dev" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Bosh sahifa</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold">Markaz</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={lbl}>Markaz nomi *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={fld} placeholder="Masalan: Smart Education" /></div>
          <div>
            <label className={lbl}>Subdomen *</label>
            <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-slate-900 dark:border-slate-700 dark:bg-slate-900">
              <input value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} className="h-10 min-w-0 flex-1 rounded-l-lg bg-transparent px-3 font-mono text-sm outline-none" placeholder="smart" />
              <span className="pr-3 font-mono text-sm text-slate-400">.{baseDomain}</span>
            </div>
          </div>
          <div><label className={lbl}>Tarif</label><input value={f.plan} onChange={(e) => set("plan", e.target.value)} className={fld} /></div>
          <div>
            <label className={lbl}>Litsenziya muddati</label>
            <select value={f.months} onChange={(e) => set("months", Number(e.target.value))} className={fld}>
              {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} oy</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold">Direktor hisobi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={lbl}>F.I.Sh. *</label><input value={f.directorName} onChange={(e) => set("directorName", e.target.value)} className={fld} /></div>
          <div><label className={lbl}>Email (login) *</label><input type="email" value={f.directorEmail} onChange={(e) => set("directorEmail", e.target.value)} className={fld} /></div>
          <div><label className={lbl}>Telefon</label><input value={f.directorPhone} onChange={(e) => set("directorPhone", e.target.value)} className={fld} placeholder="+998 90 123 45 67" /></div>
          <div>
            <label className={lbl}>Parol *</label>
            <div className="flex gap-2">
              <input value={f.directorPassword} onChange={(e) => set("directorPassword", e.target.value)} className={`${fld} font-mono`} />
              <button type="button" onClick={() => set("directorPassword", genPass())} className="shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-700">Yangi</button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 font-semibold">Modullar</h2>
        <p className="mb-4 text-xs text-slate-500">Keyin markaz sahifasidan istalgan vaqtda o'zgartirish mumkin.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map((m) => (
            <label key={m.key} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${mods.has(m.key) ? "border-slate-900 bg-slate-50 dark:border-slate-300 dark:bg-white/5" : "border-slate-200 dark:border-slate-800"}`}>
              <input type="checkbox" checked={mods.has(m.key)} onChange={(e) => setMods((p) => { const n = new Set(p); if (e.target.checked) n.add(m.key); else n.delete(m.key); return n; })} className="mt-0.5" />
              <span><span className="block text-sm font-semibold">{m.name}</span><span className="block text-xs text-slate-500">{m.desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold">Mijoz bilan aloqa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={lbl}>Mas'ul shaxs</label><input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} className={fld} /></div>
          <div><label className={lbl}>Telefon</label><input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={fld} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Izoh</label><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900" placeholder="Shartnoma, to'lov kelishuvi va h.k." /></div>
        </div>
      </section>

      {res?.error && !res.steps && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{res.error}</p>}
      <div className="flex items-center justify-end gap-3">
        {pending && <span className="text-sm text-slate-500">Markaz yaratilmoqda: baza, xizmat, subdomen va SSL... (1–2 daqiqa)</span>}
        <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">
          {pending ? "Yaratilmoqda..." : "Markazni yaratish"}
        </button>
      </div>
    </div>
  );
}
