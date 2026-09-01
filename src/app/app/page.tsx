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
import { Ico, type IcoName } from "./Icons";

// Ochiq sahifa — o'quv markazi haqida qisqacha va ILOVANI YUKLAB OLISH.
// Asosiy manzil (/) boshqaruv tizimiga tegishli, bu sahifa esa o'quvchilar
// uchun: havolasi germaniya.live/app (yoki /ilova).

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

const TEAL = "#0e7490";
const APP_URL = "https://germaniya.live/app";

const FEATURES: { icon: IcoName; title: string; text: string }[] = [
  { icon: "play", title: "Video darslar", text: "Har dars videosi, topshirig'i va uy vazifasi bir joyda." },
  { icon: "book", title: "Lug'at", text: "Nemischa-o'zbekcha bosma lug'at — qidiruv va daraja bo'yicha filtr." },
  { icon: "target", title: "Mashq va o'yin", text: "Jang rejimi, so'z o'yinlari va krossvordlar." },
  { icon: "chat", title: "Ustoz bilan aloqa", text: "Savolingizni yozing — o'qituvchi ilovada javob beradi." },
  { icon: "trophy", title: "Tanga va yulduz", text: "Faolligingiz uchun ball yig'ing, sovg'aga almashtiring." },
  { icon: "chart", title: "Natijalaringiz", text: "Davomat, baholar va daraja bo'yicha jarayon." },
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

  // Yumaloqlangan ko'rsatkichlar — aniq son emas, tartib muhim
  const round = (n: number) => (n >= 100 ? `${Math.floor(n / 50) * 50}+` : n >= 20 ? `${Math.floor(n / 10) * 10}+` : String(n));

  const stats = [
    { value: round(students), label: "o'quvchi" },
    { value: round(teachers), label: "ustoz" },
    { value: round(groups), label: "faol guruh" },
    { value: `${Math.floor(DICT_SIZE / 1000)} 000+`, label: "so'z lug'atda" },
  ].filter((x) => x.value !== "0");

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* ══════════ Sarlavha ══════════ */}
      <header className="sticky top-0 z-40 border-b border-slate-900/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="h-8 w-auto" />
          <nav className="ml-auto hidden items-center gap-7 text-[14.5px] font-semibold text-slate-500 sm:flex">
            <a href="#ilova" className="transition hover:text-slate-900">Ilova</a>
            <a href="#imkoniyat" className="transition hover:text-slate-900">Imkoniyatlar</a>
            <a href="#darajalar" className="transition hover:text-slate-900">Darajalar</a>
          </nav>
          <Link
            href={cabinet?.href ?? "/login"}
            className="ml-auto rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white transition active:scale-95 sm:ml-7"
            style={{ background: TEAL }}
          >
            {cabinet?.label ?? "Xodimlar kirishi"}
          </Link>
        </div>
      </header>

      {/* ══════════ Bosh ekran ══════════ */}
      <section className="relative overflow-hidden">
        {/* fon — yumshoq rangli dog'lar */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[#f7fbfd]" />
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 -z-10 h-[420px] w-[420px] rounded-full bg-[#a8e0ef] opacity-40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-20 top-32 -z-10 h-[380px] w-[380px] rounded-full bg-[#c7d7fb] opacity-40 blur-3xl" />

        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 md:grid-cols-[1.05fr_0.95fr] md:items-center md:pb-24 md:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#0b6a83] shadow-[0_4px_14px_-6px_rgba(11,60,77,0.5)] ring-1 ring-[#0e7490]/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              A1 — C2 · Deutsch
            </span>

            <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[56px]">
              Nemis tilini
              <br />
              <span className="bg-gradient-to-r from-[#0b5d76] via-[#0e7490] to-[#17a2bf] bg-clip-text text-transparent">
                telefoningizda
              </span>{" "}
              o&apos;rganing
            </h1>

            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-slate-500">
              Darslar, uy vazifalari, lug&apos;at va natijalaringiz — hammasi bitta ilovada.
              O&apos;quv markazimiz o&apos;quvchilari uchun.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#ilova"
                className="group inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[15.5px] font-bold text-white shadow-[0_16px_34px_-14px_rgba(14,116,144,0.95)] transition active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
              >
                Ilovani olish
                <Ico name="arrow" className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/login"
                className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3.5 text-[15.5px] font-bold text-slate-700 transition hover:border-slate-300"
              >
                Hisobimga kirish
              </Link>
            </div>

            {stats.length > 0 ? (
              <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-[26px] font-extrabold leading-none tracking-[-0.02em]" style={{ color: TEAL }}>
                      {s.value}
                    </dt>
                    <dd className="mt-1.5 text-[12.5px] font-medium leading-tight text-slate-400">{s.label}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {/* Telefon maketi */}
          <PhoneMock />
        </div>
      </section>

      {/* ══════════ Ilovani yuklab olish ══════════ */}
      <section id="ilova" className="scroll-mt-20 px-5 py-14 md:py-20">
        <div
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[34px] p-8 text-white shadow-[0_40px_70px_-40px_rgba(11,60,77,0.95)] md:p-12"
          style={{ background: "linear-gradient(145deg, #0a4f66 0%, #0e7490 48%, #17a2bf 100%)" }}
        >
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

          <div className="relative grid gap-9 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <h2 className="text-[32px] font-extrabold leading-tight tracking-[-0.025em] md:text-[40px]">
                O&apos;quvchi ilovasi
              </h2>
              <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-white/80">
                Telefoningizga o&apos;rnating — darslar, uy vazifalari va ustoz bilan
                yozishma har doim qo&apos;l ostingizda bo&apos;ladi.
              </p>
              <ul className="mt-6 space-y-2.5 text-[14.5px] text-white/90">
                {[
                  "Bepul, reklamasiz",
                  "Login o'quv markazidan beriladi",
                  "Android va iPhone uchun",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2.5">
                    <span className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-400/25 text-emerald-200">
                      <Ico name="check" className="h-3 w-3" />
                    </span>
                    {x}
                  </li>
                ))}
              </ul>

              {/* Kompyuterda — telefonda ochish uchun QR */}
              <div className="mt-8 hidden items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 md:flex">
                <div
                  className="grid h-[92px] w-[92px] shrink-0 place-items-center rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                  // QR o'z serverimizda hosil qilinadi — tashqi xizmat ishlatilmaydi
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <div className="text-[13.5px] leading-relaxed text-white/80">
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

      {/* ══════════ Imkoniyatlar ══════════ */}
      <section id="imkoniyat" className="scroll-mt-20 px-5 pb-16 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-[30px] font-extrabold tracking-[-0.025em] md:text-[38px]">
            Ilovada nimalar bor
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-[15.5px] leading-relaxed text-slate-500">
            Darsdan tashqarida ham o&apos;rganishda davom etish uchun kerak bo&apos;lgan hamma narsa.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-[26px] border border-slate-100 bg-white p-6 shadow-[0_18px_40px_-30px_rgba(15,60,80,0.8)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-28px_rgba(15,60,80,0.85)]"
              >
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-[0_10px_20px_-10px_rgba(14,116,144,0.9)]"
                  style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
                >
                  <Ico name={f.icon} className="h-[22px] w-[22px]" />
                </span>
                <h3 className="mt-4 text-[17.5px] font-extrabold tracking-[-0.015em]">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ Darajalar ══════════ */}
      {levels.length > 0 ? (
        <section id="darajalar" className="scroll-mt-20 bg-[#f7fbfd] px-5 py-16 md:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[30px] font-extrabold tracking-[-0.025em] md:text-[38px]">Darajalar</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[15.5px] leading-relaxed text-slate-500">
              Boshlang&apos;ichdan ona tili darajasigacha — har bosqichda darslar, mashqlar va yakuniy imtihon.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {levels.map((l) => (
                <div
                  key={l.id}
                  className="relative flex min-h-[136px] flex-col justify-between overflow-hidden rounded-[26px] p-5 text-white shadow-[0_22px_44px_-28px_rgba(15,60,80,0.95)]"
                  style={l.bannerUrl ? { backgroundColor: "#12303f" } : { background: levelGradient(l.color) }}
                >
                  {l.bannerUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/25" />
                    </>
                  ) : null}
                  <span className="relative text-[28px] font-extrabold leading-none tracking-[-0.02em]">{l.code}</span>
                  <span className="relative text-[15px] font-semibold text-white/85">{levelTitle(l, "uz")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ══════════ Aloqa ══════════ */}
      <footer className="border-t border-slate-100 px-5 py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="h-10 w-auto" />
          <p className="max-w-md text-[15px] leading-relaxed text-slate-500">
            Nemis tili o&apos;quv markazi. Kursga yozilish va savollar uchun bog&apos;laning.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="tel:+998995500055"
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[14.5px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(14,116,144,0.9)]"
              style={{ background: TEAL }}
            >
              <Ico name="phone" className="h-4 w-4" />
              +998 99 550 00 55
            </a>
            <a
              href="https://t.me/germaniyalive"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 px-5 py-3 text-[14.5px] font-bold text-slate-700 transition hover:border-slate-300"
            >
              <Ico name="send" className="h-4 w-4" />
              Telegram
            </a>
          </div>
          <div className="text-[12.5px] text-slate-400">© {new Date().getFullYear()} Germaniya Live</div>
        </div>
      </footer>
    </div>
  );
}

/* ── Telefon maketi — ilovaning haqiqiy ko'rinishi ── */
function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[56px] bg-gradient-to-br from-[#17a2bf]/25 to-[#7c3aed]/15 blur-2xl" />
      <div className="rounded-[44px] bg-slate-900 p-2.5 shadow-[0_50px_90px_-40px_rgba(9,32,53,0.85)] ring-1 ring-white/10">
        <div className="relative overflow-hidden rounded-[36px] bg-[#e6eef4]">
          <div className="absolute left-1/2 top-2.5 z-10 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-slate-900" />

          <div className="space-y-2.5 px-3.5 pb-5 pt-10">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-extrabold leading-tight">Salom, Ezoza!</div>
                <div className="text-[10px] text-slate-500">Bugungi darsingiz tayyor</div>
              </div>
              <span className="rounded-xl bg-white px-2 py-1 text-[10px] font-bold text-orange-500 shadow-sm">🔥 7</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { v: "45", l: "tanga" },
                { v: "12", l: "yulduz" },
                { v: "7", l: "seriya" },
                { v: "3", l: "o'rin" },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-white py-2 text-center shadow-[0_4px_10px_-6px_rgba(15,60,80,0.5)]">
                  <div className="text-[13px] font-extrabold">{x.v}</div>
                  <div className="text-[7.5px] text-slate-400">{x.l}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-3 text-white shadow-[0_10px_22px_-14px_rgba(15,60,80,0.9)]" style={{ background: levelGradient(TEAL) }}>
              <div className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/70">Bugungi dars</div>
              <div className="mt-0.5 text-[17px] font-extrabold leading-tight">Unit 1.1</div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full w-[38%] rounded-full bg-white" />
                </div>
                <span className="text-[10px] font-extrabold">38%</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-[0_6px_14px_-10px_rgba(15,60,80,0.6)]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#46d8b8,#0f9a90)" }}>
                <Ico name="play" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold leading-tight">Video va podkastlar</div>
                <div className="text-[9.5px] text-slate-400">Qiziqarli materiallar</div>
              </div>
            </div>

            {/* pastki menyu */}
            <div className="mt-1 flex items-center justify-around rounded-2xl bg-white py-2 shadow-[0_6px_14px_-10px_rgba(15,60,80,0.6)]">
              {(["home", "book", "target", "user"] as IcoName[]).map((n, i) => (
                <Ico key={n} name={n} className={"h-[18px] w-[18px] " + (i === 0 ? "text-[#0e7490]" : "text-slate-300")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
