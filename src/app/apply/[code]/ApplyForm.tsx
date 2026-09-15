"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../../(app)/_components/Icon";
import { lookupTelegram, submitApplication, type StudyFormat, type TelegramProfile } from "./actions";
import type { ApplyQuestion } from "../../(app)/links/questions";
import { fmtUzPhoneInput } from "@/lib/phone";
import { DEFAULT_COUNTRY_ISO, localDigitsOk, phoneCountry } from "@/lib/phoneCodes";
import CountryPicker from "./CountryPicker";
import { useApplyBg } from "./ApplyShell";

/**
 * Ochiq ariza formasi — telefon uchun (2026-09-15 talab):
 *   1) Ta'lim shakli — onlayn / oflayn
 *   2) Oflayn → filial tanlash
 *   3) Ism-familiya, telefon (davlat kodi bilan), onlayn → Telegram username
 *   4) Daraja — A1 / A2 / B1 / B2 (Sozlamalar > Darajalar ro'yxatidan)
 *   + havolaga biriktirilgan qo'shimcha savollar (bo'lsa)
 * Ko'rinish /daraja-testi bilan bir xil brend uslubda.
 */
export default function ApplyForm({ code, preview, questions = [], levels, branches }: {
  code: string;
  preview: boolean;
  /** Havola yaratishda belgilangan qo'shimcha savollar (bo'lmasa — faqat asosiy maydonlar) */
  questions?: ApplyQuestion[];
  /** Sozlamalar > Darajalar katalogidagi kodlar */
  levels: string[];
  /** Faol filiallar — oflayn ta'lim uchun; `image` — filial surati (tanlanganda orqa fon) */
  branches: { id: string; name: string; address: string | null; image: string | null }[];
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
  // Telegram profili — username yozilgach t.me dan ism/rasm olib ko'rsatiladi
  const [tgProfile, setTgProfile] = useState<TelegramProfile | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [level, setLevel] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));

  const country = useMemo(() => phoneCountry(countryIso), [countryIso]);
  // Oflayn filial tanlanganda uning surati sahifa foniga tushadi (ApplyShell chizadi)
  const bgImage = format === "OFFLINE" ? branches.find((b) => b.id === branchId)?.image ?? null : null;
  const setBg = useApplyBg();
  useEffect(() => { setBg(bgImage); }, [bgImage, setBg]);

  // Username o'zgarganda 600 ms kutib, profilni tekshiramiz (har harfda emas)
  useEffect(() => {
    const u = telegram.trim();
    if (u.length < 4) { setTgProfile(null); setTgLoading(false); return; }
    setTgLoading(true);
    let alive = true;
    const t = setTimeout(async () => {
      const r = await lookupTelegram(u).catch(() => null);
      if (!alive) return;
      setTgProfile(r);
      setTgLoading(false);
    }, 600);
    return () => { alive = false; clearTimeout(t); };
  }, [telegram]);
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
        telegramName: tgProfile?.ok && tgProfile.username.toLowerCase() === telegram.trim().toLowerCase() ? tgProfile.name : undefined,
      });
      if (r.ok) { setDone(true); window.scrollTo({ top: 0 }); }
      else setError(r.error ?? "Xatolik");
    });
  };

  // ── Yakun ──
  if (done) {
    return (
      <div className="animate-pop-in mt-6">
        <div className={CARD + " p-6 text-center"}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Icon name="check" className="h-8 w-8" strokeWidth={2} />
          </div>
          <div className="mt-4 text-[22px] font-black text-slate-900 dark:text-white">Arizangiz qabul qilindi!</div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
            {fullName.trim().split(" ")[0]}, tez orada siz bilan bog&apos;lanamiz.
          </p>
        </div>

        {/* Kutish vaqtida — darajani aniqlash testi */}
        <a
          href="/daraja-testi"
          className="mt-3 flex items-center gap-3 rounded-3xl border border-white/60 bg-gradient-to-r from-brand-600 to-cyan-500 p-4 text-white shadow-[0_16px_36px_-14px_rgba(65,72,239,0.6)] transition active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Icon name="clipboard" className="h-6 w-6" strokeWidth={1.8} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">Darajangizni hozir tekshiring</span>
            <span className="block text-[12.5px] text-white/85">25 ta savol, ~10 daqiqa — natija darhol</span>
          </span>
          <Icon name="arrow" className="h-5 w-5 shrink-0" strokeWidth={2.2} />
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn(CARD, "mt-5 p-4")}>
      {/* 1) Ta'lim shakli */}
      <Label text="Ta'lim shakli" req />
      <div className="grid grid-cols-2 gap-2">
        <Choice on={format === "ONLINE"} onClick={() => setFormat("ONLINE")} icon="video" title="Onlayn" sub="Telegram orqali" />
        <Choice on={format === "OFFLINE"} onClick={() => setFormat("OFFLINE")} icon="building" title="Oflayn" sub="Filialda" />
      </div>

      {/* 2) Oflayn — filial */}
      {format === "OFFLINE" && (
        <div className="animate-pop-in mt-4">
          <Label text="Filial" req />
          {branches.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">Hozircha faol filial yo&apos;q — onlayn shaklni tanlang.</p>
          ) : (
            <div className={cn("grid gap-2", branches.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {branches.map((b) => (
                <Choice key={b.id} on={branchId === b.id} onClick={() => setBranchId(b.id)} icon="pin" title={b.name} sub={b.address ?? undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3) Shaxsiy ma'lumotlar — shakl tanlangach */}
      {format && (
        <div className="animate-pop-in mt-4">
          <Label text="Ism va familiya" req />
          <input value={fullName} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Ism Familiya" className={INPUT} />

          <Label text="Telefon raqami" req className="mt-3" />
          {/* INPUT'dagi px-4 bu yerda kerak emas (cn = clsx, px-0 uni yengmaydi) — shuning uchun alohida klasslar */}
          <div className={cn(FIELD_BOX, "gap-2 pr-3")}>
            {/* Davlat kodi — MDH va Yevropa ro'yxati (SVG bayroqli panel); standart O'zbekiston */}
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

          {format === "ONLINE" && (
            <div className="animate-pop-in">
              <Label text="Telegram username" className="mt-3" />
              <div className={cn(FIELD_BOX, "gap-1.5 px-4")}>
                <Icon name="telegram" className="h-5 w-5 shrink-0 text-sky-500" strokeWidth={1.8} />
                <span className="select-none text-[16px] font-semibold text-slate-400">@</span>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value.replace(/^@+/, "").replace(/\s/g, ""))}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="h-[50px] w-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
              {/* Topilgan profil — ism, rasm, bio; topilmasa ogohlantirish */}
              {telegram.trim().length >= 4 && (tgLoading || tgProfile) && (
                <div className="animate-pop-in mt-2">
                  {tgLoading || !tgProfile ? (
                    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" /> Telegram tekshirilmoqda…
                    </div>
                  ) : tgProfile.ok ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                      {tgProfile.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tgProfile.photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-white/10" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white"><Icon name="telegram" className="h-5 w-5" strokeWidth={1.8} /></span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{tgProfile.name}</span>
                        <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">@{tgProfile.username}{tgProfile.bio ? ` · ${tgProfile.bio}` : ""}</span>
                      </span>
                      <Icon name="check" className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.2} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      <Icon name="alert" className="h-4 w-4 shrink-0" strokeWidth={2} /> @{tgProfile.username} topilmadi — username'ni tekshiring
                    </div>
                  )}
                </div>
              )}
              <p className="mt-1.5 text-[12px] text-slate-400">Darslar va materiallar Telegram orqali yuboriladi</p>
            </div>
          )}

          {/* 4) Daraja */}
          <Label text="Darajangiz" req className="mt-4" />
          <div className="grid grid-cols-4 gap-2">
            {levels.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={cn(
                  "min-h-[52px] rounded-2xl border-2 text-[16px] font-black transition active:scale-[0.97]",
                  level === l
                    ? "border-brand-600 bg-brand-600 text-white shadow-[0_10px_24px_-10px_rgba(65,72,239,0.7)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-slate-400">Bilmasangiz — A1 ni tanlang, darajani birga aniqlaymiz</p>

          {/* Qo'shimcha savollar — yoziladigan yoki variantli */}
          {questions.map((q, i) => (
            <div key={i} className="mt-4">
              <Label text={q.q} req={!!q.required} />
              {q.type === "choice" ? (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(i, opt)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-medium transition active:scale-[0.99]",
                        answers[i] === opt
                          ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                          : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
                      )}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", answers[i] === opt ? "border-brand-600 bg-brand-600" : "border-slate-300 dark:border-white/20")}>
                        {answers[i] === opt && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input value={answers[i] ?? ""} onChange={(e) => setAnswer(i, e.target.value)} required={q.required} placeholder="Javobingiz" className={INPUT} />
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={pending || preview || !format}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-[16px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(65,72,239,0.7)] transition active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
      >
        {preview ? "Ko'rib chiqish rejimi" : pending ? "Yuborilmoqda..." : "Ariza yuborish"}
        {!preview && !pending && <Icon name="arrow" className="h-5 w-5" strokeWidth={2.2} />}
      </button>
      {!format && <p className="mt-2 text-center text-[12px] text-slate-400">Boshlash uchun ta&apos;lim shaklini tanlang</p>}
    </form>
  );
}

// ── Uslub va kichik komponentlar (daraja testi sahifasi bilan bir xil) ──

const CARD = "rounded-3xl border border-white/60 bg-white/85 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]";

const INPUT =
  "min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-600";

/** Ichida tugma/prefiks bo'lgan maydon qutisi — INPUT bilan bir xil ko'rinish, lekin ichki bo'shliqsiz (overflow-hidden: tugma burchakni to'ldiradi) */
const FIELD_BOX =
  "flex min-h-[52px] w-full items-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-[16px] text-slate-900 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white";

function Label({ text, req, className }: { text: string; req?: boolean; className?: string }) {
  return (
    <div className={cn("mb-1.5 text-[12px] font-bold text-slate-600 dark:text-slate-300", className)}>
      {text} {req && <span className="text-rose-500">*</span>}
    </div>
  );
}

/** Katta tanlov kartasi — ta'lim shakli va filial uchun */
function Choice({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: string; title: string; sub?: string }) {
  // icon — ilovaning Icon to'plamidagi nom (video, building, pin ...); emoji emas — hamma qurilmada bir xil
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[64px] items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition active:scale-[0.97]",
        on
          ? "border-brand-600 bg-brand-600 text-white shadow-[0_10px_24px_-10px_rgba(65,72,239,0.7)]"
          : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", on ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600 dark:bg-white/[0.06] dark:text-brand-300")}>
        <Icon name={icon} className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-tight">{title}</span>
        {sub && <span className={cn("block truncate text-[11.5px] leading-tight", on ? "text-white/80" : "text-slate-400")}>{sub}</span>}
      </span>
    </button>
  );
}
