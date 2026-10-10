"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  extendLicenseAction, setLicenseDateAction, setSuspendedAction, setModulesAction, updateInfoAction,
  resetDirectorPasswordAction, serviceAction, retrySslAction, backupAction, deleteCenterAction,
} from "../../../actions";
import { fmtBytes, fmtDate } from "../../ui";

type Info = { slug: string; name: string; plan: string; licenseUntil: string; suspended: boolean; contactName: string; contactPhone: string; notes: string; directorEmail: string; host: string };
type Mod = { key: string; name: string; desc: string; on: boolean };

const box = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const btnDark = "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900";
const fld = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900";

export default function CenterControls({ center: c, modules, backups }: { center: Info; modules: Mod[]; backups: { name: string; bytes: number; at: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [date, setDate] = useState(c.licenseUntil);
  const [mods, setMods] = useState(new Set(modules.filter((m) => m.on).map((m) => m.key)));
  const [info, setInfo] = useState({ name: c.name, plan: c.plan, contactName: c.contactName, contactPhone: c.contactPhone, notes: c.notes });
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);
  const [del, setDel] = useState("");

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Xato" });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Litsenziya */}
        <section className={box}>
          <h2 className="font-semibold">Litsenziya</h2>
          <p className="mt-1 text-sm text-slate-500">Hozir: <b>{fmtDate(c.licenseUntil)}</b> gacha. Muddat o'tsa markaz avtomatik yopiladi va foydalanuvchilarga ogohlantirish ko'rsatiladi.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 3, 6, 12].map((m) => (
              <button key={m} disabled={pending} onClick={() => act(() => extendLicenseAction(c.slug, m), `Litsenziya ${m} oyga uzaytirildi`)} className={btn}>+{m} oy</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fld} max-w-[180px]`} />
            <button disabled={pending || !date} onClick={() => act(() => setLicenseDateAction(c.slug, date), "Sana o'rnatildi")} className={btn}>Sanani o'rnatish</button>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            {c.suspended ? (
              <button disabled={pending} onClick={() => act(() => setSuspendedAction(c.slug, false, ""), "Markaz qayta yoqildi")} className={btnDark}>Markazni qayta yoqish</button>
            ) : (
              <button disabled={pending} onClick={() => { const r = prompt("To'xtatish sababi (masalan: to'lov qilinmagan):"); if (r === null) return; act(() => setSuspendedAction(c.slug, true, r), "Markaz to'xtatildi"); }} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300">
                Markazni to'xtatish
              </button>
            )}
          </div>
        </section>

        {/* Modullar */}
        <section className={box}>
          <h2 className="font-semibold">Modullar</h2>
          <div className="mt-3 space-y-2">
            {modules.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-start gap-3 rounded-lg p-1.5 hover:bg-slate-50 dark:hover:bg-white/5">
                <input type="checkbox" checked={mods.has(m.key)} onChange={(e) => setMods((p) => { const n = new Set(p); if (e.target.checked) n.add(m.key); else n.delete(m.key); return n; })} className="mt-1" />
                <span><span className="block text-sm font-medium">{m.name}</span><span className="block text-xs text-slate-500">{m.desc}</span></span>
              </label>
            ))}
          </div>
          <button disabled={pending} onClick={() => act(() => setModulesAction(c.slug, [...mods]), "Modullar saqlandi, markaz qayta ishga tushirildi")} className={`${btnDark} mt-3`}>Saqlash</button>
        </section>

        {/* Ma'lumotlar */}
        <section className={box}>
          <h2 className="font-semibold">Markaz ma'lumotlari</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Nomi</label><input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className={fld} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Tarif</label><input value={info.plan} onChange={(e) => setInfo({ ...info, plan: e.target.value })} className={fld} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Mas'ul shaxs</label><input value={info.contactName} onChange={(e) => setInfo({ ...info, contactName: e.target.value })} className={fld} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Telefon</label><input value={info.contactPhone} onChange={(e) => setInfo({ ...info, contactPhone: e.target.value })} className={fld} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold text-slate-500">Izoh</label><textarea value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" /></div>
          </div>
          <button disabled={pending} onClick={() => act(() => updateInfoAction(c.slug, info), "Ma'lumotlar saqlandi")} className={`${btnDark} mt-3`}>Saqlash</button>
        </section>

        {/* Kirish va xizmat */}
        <section className={box}>
          <h2 className="font-semibold">Direktor kirishi</h2>
          <p className="mt-1 text-sm text-slate-500">Login: <span className="font-mono">{c.directorEmail}</span></p>
          <button disabled={pending} onClick={() => { if (!confirm("Direktorga yangi parol yaratilsinmi? Eski parol ishlamay qoladi.")) return; setMsg(null); start(async () => { const r = await resetDirectorPasswordAction(c.slug); if (r.ok && r.password) setCred({ email: r.email!, password: r.password }); else setMsg({ ok: false, text: r.error ?? "Xato" }); }); }} className={`${btn} mt-3`}>Yangi parol yaratish</button>
          {cred && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
              <div>Login: <span className="font-mono">{cred.email}</span></div>
              <div>Parol: <span className="font-mono font-bold">{cred.password}</span></div>
              <div className="mt-1 text-xs text-slate-500">Hozir nusxalab oling — boshqa ko'rsatilmaydi.</div>
            </div>
          )}

          <h2 className="mt-5 font-semibold">Xizmat</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={pending} onClick={() => act(() => serviceAction(c.slug, "restart"), "Qayta ishga tushirildi")} className={btn}>Qayta ishga tushirish</button>
            <button disabled={pending} onClick={() => act(() => serviceAction(c.slug, "start"), "Ishga tushirildi")} className={btn}>Yoqish</button>
            <button disabled={pending} onClick={() => { if (confirm("Markaz to'xtatilsinmi? Sayt ochilmay qoladi.")) act(() => serviceAction(c.slug, "stop"), "To'xtatildi"); }} className={btn}>To'xtatish</button>
            <button disabled={pending} onClick={() => act(() => retrySslAction(c.slug), "SSL sertifikati olindi")} className={btn}>SSL ni qayta olish</button>
          </div>
        </section>

        {/* Zaxira */}
        <section className={box}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Zaxira nusxalar</h2>
            <button disabled={pending} onClick={() => act(() => backupAction(c.slug), "Zaxira olindi")} className={btnDark}>Hozir zaxira olish</button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Har kecha avtomatik olinadi, oxirgi 14 tasi saqlanadi.</p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {backups.length === 0 && <li className="py-2 text-slate-400">Hali zaxira yo'q</li>}
            {backups.map((b) => (
              <li key={b.name} className="flex items-center justify-between py-2">
                <span className="font-mono text-xs">{b.name}</span>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  {fmtBytes(b.bytes)} · {fmtDate(b.at)}
                  <a href={`/dev/backup/${c.slug}/${b.name}`} className="font-semibold text-slate-800 underline dark:text-slate-200">Yuklab olish</a>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Xavfli amal */}
        <section className="rounded-2xl border border-red-200 bg-red-50/40 p-5 dark:border-red-500/30 dark:bg-red-500/5">
          <h2 className="font-semibold text-red-700 dark:text-red-300">Markazni o'chirish</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Xizmat to'xtatiladi va subdomen olib tashlanadi. Ma'lumotlar o'chirilmaydi — serverda arxiv papkaga ko'chiriladi.</p>
          <div className="mt-3 flex gap-2">
            <input value={del} onChange={(e) => setDel(e.target.value)} placeholder={`Tasdiqlash: ${c.slug}`} className={`${fld} max-w-[220px] font-mono`} />
            <button disabled={pending || del !== c.slug} onClick={() => start(async () => { const r = await deleteCenterAction(c.slug, del); if (r.ok) router.push("/dev"); else setMsg({ ok: false, text: r.error ?? "Xato" }); })} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">O'chirish</button>
          </div>
        </section>
      </div>
    </div>
  );
}
