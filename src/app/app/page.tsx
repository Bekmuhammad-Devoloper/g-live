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

// Ochiq sahifa — o'quv markazi va ILOVANI YUKLAB OLISH.
// Uslub: yorqin, o'yinli — ilovaning o'zi (tanga, yulduz, jang) bilan bir
// ohangda. Asosiy manzil (/) boshqaruv tizimiga tegishli, bu sahifa esa
// o'quvchilar uchun: germaniya.live/app (yoki /ilova).

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

const FEATURES: { emoji: string; title: string; text: string; bg: string; ring: string }[] = [
  { emoji: "🎬", title: "Video darslar", text: "Har dars videosi, topshirig'i va uy vazifasi bir joyda.", bg: "bg-[#fff1f2]", ring: "ring-[#fecdd3]" },
  { emoji: "📚", title: "Lug'at", text: "Nemischa-o'zbekcha bosma lug'at, qidiruv bilan.", bg: "bg-[#eff6ff]", ring: "ring-[#bfdbfe]" },
  { emoji: "🎮", title: "Jang va o'yinlar", text: "Duel, guruh chempionati, so'z o'yini va krossvord.", bg: "bg-[#f5f3ff]", ring: "ring-[#ddd6fe]" },
  { emoji: "💬", title: "Ustoz bilan aloqa", text: "Savolingizni yozing — o'qituvchi ilovada javob beradi.", bg: "bg-[#ecfdf5]", ring: "ring-[#a7f3d0]" },
  { emoji: "🏆", title: "Tanga va yulduz", text: "Faolligingiz uchun ball yig'ing, sovg'aga almashtiring.", bg: "bg-[#fffbeb]", ring: "ring-[#fde68a]" },
  { emoji: "📊", title: "Natijalaringiz", text: "Davomat, baholar va daraja bo'yicha jarayon.", bg: "bg-[#f0fdfa]", ring: "ring-[#99f6e4]" },
];

const LEVEL_EMOJI = ["🌱", "🌿", "🌳", "🔥", "⭐", "👑"];

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
    { emoji: "🎓", value: round(students), label: "o'quvchi", bg: "bg-[#fef3c7]" },
    { emoji: "🧑‍🏫", value: round(teachers), label: "ustoz", bg: "bg-[#dbeafe]" },
    { emoji: "👥", value: round(groups), label: "faol guruh", bg: "bg-[#dcfce7]" },
    { emoji: "📖", value: `${Math.floor(DICT_SIZE / 1000)}k+`, label: "so'z lug'atda", bg: "bg-[#ede9fe]" },
  ].filter((x) => x.value !== "0");

  return (
    <div className="min-h-screen bg-[#fffdf8] text-slate-900 antialiased">
      {/* ══════════ Sarlavha ══════════ */}
      <header className="sticky top-0 z-40 border-b border-slate-900/[0.07] bg-[#fffdf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-3 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="h-8 w-auto" />
          <nav className="ml-auto hidden items-center gap-8 text-[15px] font-extrabold text-slate-500 sm:flex">
            <a href="#ilova" className="transition hover:text-slate-900">Ilova</a>
            <a href="#imkoniyat" className="transition hover:text-slate-900">Imkoniyatlar</a>
            <a href="#darajalar" className="transition hover:text-slate-900">Darajalar</a>
          </nav>
          <Link
            href={cabinet?.href ?? "/login"}
            className="ml-auto rounded-2xl bg-[#0e7490] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_4px_0_#0a4f66] transition-all active:translate-y-[3px] active:shadow-none sm:ml-8"
          >
            {cabinet?.label ?? "Xodimlar kirishi"}
          </Link>
        </div>
      </header>

      {/* ══════════ Bosh blok ══════════ */}
      <section className="px-4 pt-6 md:pt-10">
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] px-6 py-14 text-center md:px-12 md:py-20"
          style={{ background: "linear-gradient(150deg,#17a2bf 0%,#0e7490 45%,#0a4f66 100%)" }}
        >
          {/* bezaklar */}
          <span aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-white/[0.07]" />
          <span aria-hidden className="pointer-events-none absolute left-[7%] top-[24%] hidden text-[42px] md:block">✨</span>
          <span aria-hidden className="pointer-events-none absolute right-[9%] top-[20%] hidden text-[38px] md:block">🇩🇪</span>
          <span aria-hidden className="pointer-events-none absolute bottom-[16%] left-[13%] hidden text-[34px] md:block">📚</span>
          <span aria-hidden className="pointer-events-none absolute bottom-[20%] right-[14%] hidden text-[36px] md:block">🏆</span>

          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[12.5px] font-extrabold uppercase tracking-[0.1em] text-white ring-1 ring-white/25 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
              A1 — C2 · Deutsch
            </span>

            <h1 className="mt-6 text-[42px] font-black leading-[1.02] tracking-[-0.035em] text-white sm:text-[68px]">
              Nemis tilini
              <br />
              o&apos;rganing 🚀
            </h1>

            <p className="mx-auto mt-5 max-w-lg text-[17px] font-medium leading-relaxed text-white/85">
              Darslar, uy vazifalari, lug&apos;at va o&apos;yinlar — hammasi bitta ilovada.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a
                href="#ilova"
                className="inline-flex items-center justify-center rounded-2xl bg-[#fbbf24] px-7 py-4 text-[17px] font-extrabold text-slate-900 shadow-[0_5px_0_#b45309] transition-all active:translate-y-[4px] active:shadow-none"
              >
                Bepul boshlash
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-white/15 px-7 py-4 text-[17px] font-extrabold text-white ring-1 ring-white/25 backdrop-blur-sm transition active:scale-[0.98]"
              >
                Hisobimga kirish
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ Ko'rsatkichlar ══════════ */}
      {stats.length > 0 && (
        <section className="px-4 pt-5">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className={`flex items-center gap-3 rounded-[26px] ${s.bg} px-4 py-4`}>
                <span className="text-[30px] leading-none">{s.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-[26px] font-black leading-none tracking-[-0.02em]">{s.value}</span>
                  <span className="mt-1 block truncate text-[12.5px] font-bold text-slate-500">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════ Imkoniyatlar ══════════ */}
      <section id="imkoniyat" className="scroll-mt-24 px-4 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-[32px] font-black tracking-[-0.03em] md:text-[42px]">
            Ilovada nimalar bor?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-[16px] font-medium text-slate-500">
            Darsdan tashqarida ham o&apos;rganishda davom etish uchun hamma narsa.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`rounded-[30px] ${f.bg} p-6 ring-2 ${f.ring} transition hover:-translate-y-1`}
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[28px] shadow-[0_6px_0_rgba(15,60,80,0.08)]">
                  {f.emoji}
                </span>
                <h3 className="mt-4 text-[19px] font-black tracking-[-0.02em]">{f.title}</h3>
                <p className="mt-1.5 text-[14.5px] font-medium leading-relaxed text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Ilovani yuklab olish ══════════ */}
      <section id="ilova" className="scroll-mt-24 px-4 pb-14 md:pb-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[40px] bg-[#1a1333] p-8 text-white md:p-12">
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#7c3aed]/40 blur-2xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-[#17a2bf]/30 blur-2xl" />

          <div className="relative grid gap-9 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <span className="text-[44px] leading-none">📱</span>
              <h2 className="mt-3 text-[34px] font-black leading-tight tracking-[-0.03em] md:text-[42px]">
                Ilovani oling
              </h2>
              <p className="mt-3 max-w-md text-[16px] font-medium leading-relaxed text-white/70">
                Telefoningizga o&apos;rnating — darslar va ustoz bilan yozishma har doim
                qo&apos;l ostingizda.
              </p>

              <ul className="mt-6 space-y-2.5 text-[15px] font-semibold text-white/90">
                {["Bepul, reklamasiz", "Login o'quv markazidan beriladi", "Android va iPhone uchun"].map((x) => (
                  <li key={x} className="flex items-start gap-2.5">
                    <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#4ade80] text-[11px] font-black text-slate-900">✓</span>
                    {x}
                  </li>
                ))}
              </ul>

              {/* Kompyuterda — telefonda ochish uchun QR */}
              <div className="mt-8 hidden items-center gap-4 rounded-[26px] bg-white/10 p-4 ring-1 ring-white/15 md:flex">
                <div
                  className="grid h-[92px] w-[92px] shrink-0 place-items-center rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <div className="text-[14px] font-medium leading-relaxed text-white/75">
                  <div className="font-extrabold text-white">Telefonda oching</div>
                  Kamerani QR ga tuting.
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
        <section id="darajalar" className="scroll-mt-24 px-4 pb-14 md:pb-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[32px] font-black tracking-[-0.03em] md:text-[42px]">Darajalar</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[16px] font-medium text-slate-500">
              Boshlang&apos;ichdan ona tili darajasigacha — har bosqichda darslar, mashqlar va imtihon.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {levels.map((l, i) => (
                <div
                  key={l.id}
                  className="relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[30px] p-6 text-white"
                  style={l.bannerUrl ? { backgroundColor: "#12303f" } : { background: levelGradient(l.color) }}
                >
                  {l.bannerUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/25" />
                    </>
                  ) : (
                    <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
                  )}
                  <div className="relative flex items-start justify-between gap-2">
                    <span className="text-[32px] font-black leading-none tracking-[-0.03em]">{l.code}</span>
                    <span className="text-[26px] leading-none">{LEVEL_EMOJI[i] ?? "📘"}</span>
                  </div>
                  <span className="relative text-[16px] font-bold text-white/85">{levelTitle(l, "uz")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ Aloqa ══════════ */}
      <footer className="px-4 pb-12">
        <div className="mx-auto max-w-6xl rounded-[40px] bg-[#f1f5f9] px-6 py-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="mx-auto h-10 w-auto" />
          <p className="mx-auto mt-4 max-w-md text-[15.5px] font-medium leading-relaxed text-slate-500">
            Nemis tili o&apos;quv markazi. Kursga yozilish va savollar uchun bog&apos;laning.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="tel:+998995500055"
              className="rounded-2xl bg-[#0e7490] px-6 py-3.5 text-[15px] font-extrabold text-white shadow-[0_4px_0_#0a4f66] transition-all active:translate-y-[3px] active:shadow-none"
            >
              📞 +998 99 550 00 55
            </a>
            <a
              href="https://t.me/germaniyalive"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-white px-6 py-3.5 text-[15px] font-extrabold text-slate-700 shadow-[0_4px_0_#cbd5e1] transition-all active:translate-y-[3px] active:shadow-none"
            >
              ✈️ Telegram
            </a>
          </div>
          <div className="mt-8 text-[13px] font-semibold text-slate-400">© {new Date().getFullYear()} Germaniya Live</div>
        </div>
      </footer>
    </div>
  );
}
