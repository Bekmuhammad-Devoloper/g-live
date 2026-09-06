import Link from "next/link";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getActiveLevels, levelTitle } from "@/lib/studyLevels";
import { levelGradient } from "@/lib/levelColor";
import { getAppRelease } from "@/lib/appRelease";
import { DICT_SIZE } from "@/lib/dictionary";
import InstallApp from "./InstallApp";
import AppPreview from "./AppPreview";

// Ochiq sahifa — o'quv markazi va ILOVANI YUKLAB OLISH.
// Asosiy manzil (/) boshqaruv tizimiga tegishli; bu sahifa o'quvchilar
// uchun: germaniya.live/app (yoki /ilova).
//
// Shrift tashqi xizmatdan olinmaydi (globals.css dagi tizim shrifti) —
// Google Fonts uzilganda sayt buzilmasin.

export const metadata: Metadata = {
  metadataBase: new URL("https://germaniya.live"),
  title: "Germaniya Live — nemis tili o'quv markazi",
  description:
    "A1 dan C2 gacha nemis tili kurslari. Darslar, uy vazifalari va natijalaringiz telefoningizdagi ilovada.",
  openGraph: {
    title: "Germaniya Live",
    description: "Nemis tili kurslari va o'quvchi ilovasi",
    images: ["/icons/icon-512.png"],
  },
};

const APP_URL = "https://germaniya.live/app";
const TEAL = "#0e7490";

const STEPS = [
  { n: "1", title: "Kursga yoziling", text: "O'quv markazidan guruh tanlaysiz va login-parol olasiz." },
  { n: "2", title: "Ilovani o'rnating", text: "Androidga yuklab olasiz yoki iPhone'da bosh ekranga qo'shasiz." },
  { n: "3", title: "O'rganishni boshlang", text: "Darslar, uy vazifalari va o'yinlar — hammasi qo'l ostingizda." },
];

const FEATURES: { icon: string; title: string; text: string; tint: string; fg: string }[] = [
  { icon: "M8 5.2v13.6L19 12 8 5.2Z", title: "Video darslar", text: "Har dars videosi, topshirig'i va uy vazifasi bir joyda.", tint: "bg-rose-50", fg: "text-rose-500" },
  { icon: "M12 6.6C10.5 5.1 8.4 4.5 4.6 4.6v13c3.8-.1 5.9.5 7.4 2 1.5-1.5 3.6-2.1 7.4-2v-13c-3.8-.1-5.9.5-7.4 2ZM12 6.6v13", title: "Lug'at", text: "Nemischa-o'zbekcha bosma lug'at, qidiruv va daraja filtri bilan.", tint: "bg-blue-50", fg: "text-blue-500" },
  { icon: "M12 3.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4Zm0 4.1a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 0 0 0-8.2Z", title: "Jang va o'yinlar", text: "Duel, guruh chempionati, so'z o'yini va krossvord.", tint: "bg-violet-50", fg: "text-violet-500" },
  { icon: "M20.5 12.2c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4.2 20.4l1.5-3.7A6.9 6.9 0 0 1 3.5 12.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z", title: "Ustoz bilan aloqa", text: "Savolingizni yozing — o'qituvchi ilovada javob beradi.", tint: "bg-emerald-50", fg: "text-emerald-500" },
  { icon: "M7 4.5h10v4.2a5 5 0 0 1-10 0V4.5ZM7 6H4.6v1.4A3.2 3.2 0 0 0 7.4 10.6M17 6h2.4v1.4a3.2 3.2 0 0 1-2.8 3.2M12 13.7v3.6M8.8 19.8h6.4", title: "Tanga va yulduz", text: "Faolligingiz uchun ball yig'ing, sovg'aga almashtiring.", tint: "bg-amber-50", fg: "text-amber-500" },
  { icon: "M4.5 19.5h15M7.5 16.5v-5M12 16.5v-9M16.5 16.5v-3", title: "Natijalaringiz", text: "Davomat, baholar va daraja bo'yicha jarayon.", tint: "bg-teal-50", fg: "text-teal-500" },
];

export default async function LandingPage() {
  const [session, levels, apk, students, teachers, groups, qr] = await Promise.all([
    getSession(),
    getActiveLevels(),
    getAppRelease(),
    prisma.student.count(),
    prisma.user.count({ where: { role: ROLES.TEACHER, isActive: true } }),
    prisma.group.count({ where: { status: "ACTIVE" } }),
    QRCode.toString(APP_URL, { type: "svg", margin: 0, width: 168, color: { dark: "#0b3c4d", light: "#ffffff" } }),
  ]);

  const cabinet = !session
    ? null
    : session.role === ROLES.STUDENT
      ? { href: "/student", label: "Ilovaga o'tish" }
      : { href: "/dashboard", label: "Kabinet" };

  const fmt = (d: Date | null) => {
    if (!d) return null;
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  };

  // Yumaloqlangan ko'rsatkichlar — aniq son ochiq saytda ko'rinmasin
  const round = (n: number) => (n >= 100 ? `${Math.floor(n / 50) * 50}+` : n >= 20 ? `${Math.floor(n / 10) * 10}+` : String(n));

  const stats = [
    { value: round(students), label: "o'quvchi" },
    { value: round(teachers), label: "ustoz" },
    { value: round(groups), label: "faol guruh" },
    { value: `${Math.floor(DICT_SIZE / 1000)} 000+`, label: "so'z lug'atda" },
  ].filter((x) => x.value !== "0");

  const focus = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0e7490]/25";

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* ══════════ Sarlavha ══════════ */}
      <header className="sticky top-0 z-40 border-b border-slate-900/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-6xl items-center gap-3 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="h-8 w-auto" />
          <nav className="ml-auto hidden items-center gap-8 text-[14.5px] font-semibold text-slate-500 sm:flex">
            <a href="#ilova" className={`rounded transition hover:text-slate-900 ${focus}`}>Ilova</a>
            <a href="#imkoniyat" className={`rounded transition hover:text-slate-900 ${focus}`}>Imkoniyatlar</a>
            <a href="#darajalar" className={`rounded transition hover:text-slate-900 ${focus}`}>Darajalar</a>
          </nav>
          <Link
            href={cabinet?.href ?? "/login"}
            className={`ml-auto rounded-full bg-slate-900 px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-slate-700 sm:ml-8 ${focus}`}
          >
            {cabinet?.label ?? "Xodimlar kirishi"}
          </Link>
        </div>
      </header>

      {/* ══════════ Bosh ekran ══════════ */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[#fbfdfe]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[560px] w-[560px] rounded-full bg-[#17a2bf] opacity-[0.13] blur-[110px]" />
        <div aria-hidden className="pointer-events-none absolute -left-32 top-40 -z-10 h-[420px] w-[420px] rounded-full bg-[#7c3aed] opacity-[0.08] blur-[110px]" />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 md:grid-cols-[1.02fr_0.98fr] md:pb-28 md:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/[0.08] bg-white px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-500 shadow-[0_2px_10px_-4px_rgba(15,60,80,0.25)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              A1 — C2 · Deutsch
            </span>

            <h1 className="mt-6 text-[44px] font-extrabold leading-[1.03] tracking-[-0.04em] sm:text-[62px]">
              Nemis tilini
              <br />
              <span className="bg-gradient-to-br from-[#0b5d76] via-[#0e7490] to-[#22b8d4] bg-clip-text text-transparent">
                oson o&apos;rganing
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-[17.5px] leading-[1.65] text-slate-500">
              Darslar, uy vazifalari, lug&apos;at va o&apos;yinlar — hammasi
              telefoningizdagi bitta ilovada. O&apos;quv markazimiz o&apos;quvchilari uchun.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#ilova"
                className={`group inline-flex items-center gap-2 rounded-full bg-[#0e7490] px-7 py-4 text-[15.5px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(14,116,144,0.9)] transition hover:bg-[#0b5d76] ${focus}`}
              >
                Ilovani olish
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5">
                  <path d="M4.5 12h14m-5-5.5L19 12l-5.5 5.5" />
                </svg>
              </a>
              <Link
                href="/login"
                className={`inline-flex items-center rounded-full border border-slate-200 bg-white px-7 py-4 text-[15.5px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 ${focus}`}
              >
                Hisobimga kirish
              </Link>
            </div>

            {stats.length > 0 && (
              <dl className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
                {stats.map((s, i) => (
                  <div key={s.label} className={i > 0 ? "border-l border-slate-200 pl-8" : ""}>
                    <dt className="text-[24px] font-extrabold leading-none tracking-[-0.025em] text-slate-900">{s.value}</dt>
                    <dd className="mt-1.5 text-[12.5px] font-semibold text-slate-400">{s.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <AppPreview />
        </div>
      </section>

      {/* ══════════ Qanday boshlanadi ══════════ */}
      <section className="border-y border-slate-900/[0.06] bg-[#fbfdfe] px-5 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[32px]">Qanday boshlanadi</h2>
          <div className="mt-9 grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="text-[13px] font-extrabold tracking-[0.14em] text-[#0e7490]">0{s.n}</span>
                <h3 className="mt-2.5 text-[19px] font-extrabold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Imkoniyatlar ══════════ */}
      <section id="imkoniyat" className="scroll-mt-24 px-5 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <h2 className="text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">Ilovada nimalar bor</h2>
            <p className="mt-3 text-[16.5px] leading-relaxed text-slate-500">
              Darsdan tashqarida ham o&apos;rganishda davom etish uchun kerak bo&apos;lgan hamma narsa.
            </p>
          </div>

          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-[26px] border border-slate-900/[0.06] bg-white p-6 shadow-[0_1px_2px_rgba(15,60,80,0.04)] transition hover:-translate-y-0.5 hover:border-slate-900/[0.1] hover:shadow-[0_20px_44px_-28px_rgba(15,60,80,0.6)]"
              >
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${f.tint} ${f.fg}`}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </span>
                <h3 className="mt-4 text-[17.5px] font-extrabold tracking-[-0.02em]">{f.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Ilovani yuklab olish ══════════ */}
      <section id="ilova" className="scroll-mt-24 px-5 pb-16 md:pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[36px] bg-[#0b1620] p-8 text-white md:p-14">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#17a2bf] opacity-25 blur-[90px]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#7c3aed] opacity-20 blur-[90px]" />

          <div className="relative grid gap-10 md:grid-cols-[1.08fr_1fr] md:items-center">
            <div>
              <h2 className="text-[32px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">
                O&apos;quvchi ilovasi
              </h2>
              <p className="mt-3.5 max-w-md text-[16px] leading-relaxed text-white/65">
                Telefoningizga o&apos;rnating — darslar va ustoz bilan yozishma
                har doim qo&apos;l ostingizda bo&apos;ladi.
              </p>

              <ul className="mt-7 space-y-3 text-[15px] text-white/85">
                {["Bepul, reklamasiz", "Login o'quv markazidan beriladi", "Android va iPhone uchun"].map((x) => (
                  <li key={x} className="flex items-start gap-3">
                    <span className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4.5 12.5 5 5 10-11" />
                      </svg>
                    </span>
                    {x}
                  </li>
                ))}
              </ul>

              {/* Kompyuterda — telefonda ochish uchun QR */}
              <div className="mt-9 hidden items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-4 md:flex">
                <div
                  className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <div className="text-[13.5px] leading-relaxed text-white/70">
                  <div className="font-bold text-white">Telefonda oching</div>
                  Kamerani QR ga tuting — shu sahifa telefoningizda ochiladi.
                </div>
              </div>
            </div>

            <InstallApp
              apkHref={apk.href}
              apkReady={apk.available}
              apkSize={apk.sizeMb}
              apkDate={fmt(apk.updatedAt)}
            />
          </div>
        </div>
      </section>

      {/* ══════════ Darajalar ══════════ */}
      {levels.length > 0 && (
        <section id="darajalar" className="scroll-mt-24 border-t border-slate-900/[0.06] bg-[#fbfdfe] px-5 py-16 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-xl">
              <h2 className="text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">Darajalar</h2>
              <p className="mt-3 text-[16.5px] leading-relaxed text-slate-500">
                Boshlang&apos;ichdan ona tili darajasigacha — har bosqichda darslar, mashqlar va imtihon.
              </p>
            </div>

            <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {levels.map((l) => (
                <div
                  key={l.id}
                  className="group relative flex flex-col overflow-hidden rounded-[26px] border border-slate-900/[0.06] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-28px_rgba(15,60,80,0.6)]"
                >
                  {/* Banner TO'LIQ ko'rinadi. Ilgari `h-[96px] object-cover`
                      edi va rasmning usti-osti kesilardi — daraja belgisi
                      ("A1 TIL KURSI") yarmigacha qirqilib ketardi.
                      Balandlik rasmning o'z nisbatidan kelib chiqadi. */}
                  {l.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.bannerUrl} alt="" className="block w-full bg-slate-100" />
                  ) : null}

                  <div className="mt-auto flex items-center gap-4 p-5">
                    <span
                      className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl text-[18px] font-extrabold tracking-[-0.02em] text-white"
                      style={{ background: levelGradient(l.color) }}
                    >
                      {l.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-extrabold tracking-[-0.02em]">
                        {levelTitle(l, "uz")}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] font-semibold text-slate-400">Deutsch · {l.code}</span>
                    </span>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                      className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400"
                      stroke="currentColor"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ Yakuniy chaqiruv ══════════ */}
      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">Kursga yozilasizmi?</h2>
          <p className="mx-auto mt-3.5 max-w-md text-[16.5px] leading-relaxed text-slate-500">
            Guruhlar va narxlar haqida qo&apos;ng&apos;iroq qiling — mos darajani birga tanlaymiz.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="tel:+998995500055"
              className={`rounded-full bg-[#0e7490] px-7 py-4 text-[15.5px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(14,116,144,0.9)] transition hover:bg-[#0b5d76] ${focus}`}
            >
              +998 99 550 00 55
            </a>
            <a
              href="https://t.me/germaniyalive"
              target="_blank"
              rel="noreferrer"
              className={`rounded-full border border-slate-200 bg-white px-7 py-4 text-[15.5px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 ${focus}`}
            >
              Telegram
            </a>
          </div>
        </div>
      </section>

      {/* ══════════ Footer ══════════ */}
      <footer className="border-t border-slate-900/[0.06] px-5 py-12">
        <div className="mx-auto grid max-w-6xl gap-9 md:grid-cols-3 md:gap-6">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Germaniya Live" className="h-9 w-auto" />
            <p className="mt-3.5 max-w-xs text-[14px] leading-relaxed text-slate-500">
              Nemis tili o&apos;quv markazi. A1 dan C2 gacha kurslar va o&apos;quvchi ilovasi.
            </p>
          </div>

          <div className="md:justify-self-center">
            <div className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Sahifalar</div>
            <div className="mt-3.5 flex flex-col gap-2.5 text-[14px] font-semibold text-slate-600">
              <a href="#ilova" className={`rounded transition hover:text-slate-900 ${focus}`}>Ilovani olish</a>
              <a href="#imkoniyat" className={`rounded transition hover:text-slate-900 ${focus}`}>Imkoniyatlar</a>
              <a href="#darajalar" className={`rounded transition hover:text-slate-900 ${focus}`}>Darajalar</a>
              <Link href="/login" className={`rounded transition hover:text-slate-900 ${focus}`}>Hisobga kirish</Link>
            </div>
          </div>

          <div className="md:justify-self-end">
            <div className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Bog&apos;lanish</div>
            <div className="mt-3.5 flex flex-col items-start gap-2.5 text-[14px] font-semibold text-slate-600">
              <a href="tel:+998995500055" className={`rounded transition hover:text-slate-900 ${focus}`}>+998 99 550 00 55</a>
              <a href="https://t.me/germaniyalive" target="_blank" rel="noreferrer" className={`rounded transition hover:text-slate-900 ${focus}`}>Telegram</a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-11 max-w-6xl border-t border-slate-100 pt-6 text-[13px] text-slate-400">
          © {new Date().getFullYear()} Germaniya Live
        </div>
      </footer>
    </div>
  );
}
