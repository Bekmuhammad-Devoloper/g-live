"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { fmtUzPhoneInput } from "@/lib/phone";
import { DEFAULT_COUNTRY_ISO, localDigitsOk, phoneCountry } from "@/lib/phoneCodes";
import { normalizePromo, promoPeriod, sumLabel, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { Icon } from "../../(app)/_components/Icon";
import CountryPicker from "./CountryPicker";
import { CARD, FIELD_BOX, INPUT, Label } from "./ApplyForm";
import PlanCarousel, { type AppliedPromo } from "./PlanCarousel";
import { checkSubscribePromo, submitSubscribeLead } from "./subscribeAction";

const ERRORS: Record<string, string> = {
  center: "O'quv markazi nomini kiriting",
  contact: "Ismingizni kiriting",
  phone: "Telefon raqamini to'g'ri kiriting",
  too_many: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring",
  closed: "Bu havola endi faol emas",
  full: "Ariza qabul qilinmadi. Keyinroq urinib ko'ring",
  promo: "Bunday promokod yo'q yoki muddati tugagan",
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
  const [promoText, setPromoText] = useState("");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  const country = useMemo(() => phoneCountry(countryIso), [countryIso]);
  const onPhone = (v: string) => setPhone(countryIso === "UZ" ? fmtUzPhoneInput(v) : v.replace(/\D/g, "").slice(0, 12));
  const onCountry = (iso: string) => { setCountryIso(iso); setPhone(""); };

  const onPromoText = (v: string) => {
    setPromoText(normalizePromo(v));
    setPromo(null);
    setPromoError(null);
  };

  const applyPromo = () => {
    if (!promoText) return;
    setPromoError(null);
    startCheck(async () => {
      const r = await checkSubscribePromo(code, promoText);
      if (r.ok) setPromo({ code: r.code, discount: r.discount, months: r.months });
      else setPromoError(ERRORS[r.error] ?? ERRORS.promo);
    });
  };

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
      const r = await submitSubscribeLead(code, { centerName, contactName, phone: `${country.code} ${phone}`, city, students, planId, message, website, promo: promoText });
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
          {promo && (
            <p className="mt-3 rounded-2xl bg-emerald-500/15 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
              {promo.code} promokodi arizangizga qo&apos;shildi
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn(CARD, "mt-5 p-4")}>
      {plans.length > 0 && (
        <>
          <Label text="Tarif" />
          <PlanCarousel plans={plans} selected={planId} onSelect={setPlanId} promo={promo} />

          <Label text="Promokod" className="mt-4" />
          <div className="flex gap-2">
            <input
              value={promoText}
              onChange={(e) => onPromoText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Promokod bo'lsa kiriting"
              className={cn(INPUT, "min-w-0 flex-1 font-semibold placeholder:font-normal")}
            />
            <button
              type="button"
              onClick={applyPromo}
              disabled={!promoText || checking || !!promo}
              className="h-[50px] shrink-0 rounded-2xl border-2 border-brand-500 px-4 text-[14px] font-bold text-brand-600 transition active:scale-[0.98] disabled:opacity-50 dark:text-brand-200"
            >
              {checking ? "..." : promo ? "Qo'llandi" : "Qo'llash"}
            </button>
          </div>
          {promo && (
            <p className="animate-pop-in mt-2 text-[13px] font-semibold text-emerald-600 dark:text-emerald-300">
              {promoPeriod(promo.months)} uchun {sumLabel(promo.discount)} chegirma
            </p>
          )}
          {promoError && <p className="animate-pop-in mt-2 text-[13px] font-medium text-rose-600 dark:text-rose-300">{promoError}</p>}
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
