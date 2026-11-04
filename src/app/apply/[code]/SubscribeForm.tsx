"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { fmtUzPhoneInput } from "@/lib/phone";
import { DEFAULT_COUNTRY_ISO, localDigitsOk, phoneCountry } from "@/lib/phoneCodes";
import { planPriceLabel, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { Icon } from "../../(app)/_components/Icon";
import CountryPicker from "./CountryPicker";
import { CARD, FIELD_BOX, INPUT, Label } from "./ApplyForm";
import { submitSubscribeLead } from "./subscribeAction";

const ERRORS: Record<string, string> = {
  center: "O'quv markazi nomini kiriting",
  contact: "Ismingizni kiriting",
  phone: "Telefon raqamini to'g'ri kiriting",
  too_many: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring",
  closed: "Bu havola endi faol emas",
  full: "Ariza qabul qilinmadi. Keyinroq urinib ko'ring",
};

const limitLabel = (n: number | null, unit: string) => {
  if (!n) return `Cheksiz ${unit}`;
  if (n === 1) return `1 ta ${unit}`;
  return `${n} tagacha ${unit}`;
};

export default function SubscribeForm({ code, plans }: { code: string; plans: SalesPlan[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [planId, setPlanId] = useState("");
  const [centerName, setCenterName] = useState("");
  const [contactName, setContactName] = useState("");
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [students, setStudents] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");

  const country = useMemo(() => phoneCountry(countryIso), [countryIso]);
  const onPhone = (v: string) => setPhone(countryIso === "UZ" ? fmtUzPhoneInput(v) : v.replace(/\D/g, "").slice(0, 12));
  const onCountry = (iso: string) => { setCountryIso(iso); setPhone(""); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (centerName.trim().length < 2) { setError(ERRORS.center); return; }
    if (contactName.trim().length < 2) { setError(ERRORS.contact); return; }
    if (!localDigitsOk(countryIso, phone.replace(/\D/g, ""))) {
      setError(countryIso === "UZ" ? "Telefon raqamini to'liq kiriting: +998 XX XXX XX XX" : `Telefon raqamini to'g'ri kiriting (${country.code} ...)`);
      return;
    }
    start(async () => {
      const r = await submitSubscribeLead(code, { centerName, contactName, phone: `${country.code} ${phone}`, city, students, planId, message, website });
      if (r.ok) { setDone(true); window.scrollTo({ top: 0 }); }
      else setError(ERRORS[r.error ?? ""] ?? "Ariza yuborilmadi. Qayta urinib ko'ring");
    });
  };

  if (done) {
    return (
      <div className="animate-pop-in mt-6">
        <div className={CARD + " p-6 text-center"}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Icon name="check" className="h-8 w-8" strokeWidth={2} />
          </div>
          <div className="mt-4 text-[22px] font-black text-slate-900 dark:text-white">Arizangiz qabul qilindi!</div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
            {contactName.trim().split(" ")[0]}, tez orada siz bilan bog&apos;lanamiz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn(CARD, "mt-5 p-4")}>
      {plans.length > 0 && (
        <>
          <Label text="Tarif" />
          <div className="space-y-2">
            {plans.map((p) => {
              const on = planId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPlanId(on ? "" : p.id)}
                  className={cn(
                    "block w-full rounded-2xl border-2 px-3.5 py-3 text-left transition active:scale-[0.99]",
                    on
                      ? "border-brand-600 bg-brand-600 text-white shadow-[0_10px_24px_-10px_rgba(65,72,239,0.7)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[15px] font-bold">{p.name}</span>
                      {p.popular && (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", on ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600 dark:bg-white/[0.08] dark:text-brand-300")}>Ko&apos;p tanlanadi</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-[14px] font-extrabold tabular-nums">
                      {planPriceLabel(p.price)}
                      {!!p.price && <span className={cn("ml-1 text-[11px] font-medium", on ? "text-white/80" : "text-slate-400")}>/ oy</span>}
                    </span>
                  </span>
                  <span className={cn("mt-1 block text-[12px]", on ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>
                    {limitLabel(p.students, "o'quvchi")} · {limitLabel(p.branches, "filial")}
                  </span>
                  {p.features.length > 0 && (
                    <span className={cn("mt-2 block space-y-1 border-t pt-2", on ? "border-white/20" : "border-slate-100 dark:border-white/10")}>
                      {p.features.map((x) => (
                        <span key={x} className="flex items-start gap-1.5 text-[12.5px] leading-snug">
                          <Icon name="check" className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", !on && "text-emerald-500")} strokeWidth={2.4} />
                          {x}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <Label text="O'quv markazi nomi" req className={plans.length > 0 ? "mt-4" : undefined} />
      <input value={centerName} onChange={(e) => setCenterName(e.target.value)} required autoComplete="organization" placeholder="Markaz nomi" className={INPUT} />

      <Label text="Ism va familiya" req className="mt-3" />
      <input value={contactName} onChange={(e) => setContactName(e.target.value)} required autoComplete="name" placeholder="Ism Familiya" className={INPUT} />

      <Label text="Telefon raqami" req className="mt-3" />
      <div className={cn(FIELD_BOX, "gap-2 pr-3")}>
        <CountryPicker value={countryIso} onChange={onCountry} />
        <input
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          required
          placeholder={countryIso === "UZ" ? "90 123 45 67" : "raqam"}
          inputMode="numeric"
          autoComplete="tel-national"
          className="h-[50px] w-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Label text="Shahar" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Toshkent" className={INPUT} />
        </div>
        <div>
          <Label text="O'quvchilar soni" />
          <input value={students} onChange={(e) => setStudents(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="200" className={INPUT} />
        </div>
      </div>

      <Label text="Izoh" className="mt-3" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Savolingiz bo'lsa yozing" className={cn(INPUT, "py-3")} />

      <input aria-hidden tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      {error && <p className="animate-pop-in mt-3 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-[16px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(65,72,239,0.8)] transition active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Yuborilmoqda..." : "Ariza yuborish"}
      </button>
    </form>
  );
}
