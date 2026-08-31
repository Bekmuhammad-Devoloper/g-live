import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getActiveLevels, levelTitle } from "@/lib/studyLevels";
import { levelGradient } from "@/lib/levelColor";
import { getAppRelease } from "@/lib/appRelease";
import InstallApp from "./InstallApp";

// Ochiq sahifa — o'quv markazi haqida qisqacha va ILOVANI YUKLAB OLISH.
// Tizimga kirganlar uchun yuqorida "Kabinet" tugmasi chiqadi.

export const metadata: Metadata = {
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

function IcoCheck({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

const FEATURES = [
  { icon: "🎬", title: "Video darslar", text: "Har dars videosi, topshirig'i va uy vazifasi bir joyda." },
  { icon: "📖", title: "Lug'at", text: "6 000 dan ortiq so'z — nemischa-o'zbekcha bosma lug'at." },
  { icon: "🎯", title: "Mashq va o'yin", text: "Jang rejimi, so'z o'yinlari va krossvordlar." },
  { icon: "💬", title: "Ustoz bilan aloqa", text: "Savolingizni yozing — o'qituvchi ilovada javob beradi." },
  { icon: "🏆", title: "Tanga va yulduz", text: "Faolligingiz uchun ball yig'ing, sovg'aga almashtiring." },
  { icon: "📊", title: "Natijalaringiz", text: "Davomat, baholar va daraja bo'yicha jarayon." },
];

export default async function LandingPage() {
  const [session, levels, apk] = await Promise.all([
    getSession(),
    getActiveLevels(),
    getAppRelease(),
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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Sarlavha ── */}
      <header className="sticky top-0 z-40 border-b border-slate-900/[0.06] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="h-8 w-auto" />
          <nav className="ml-auto hidden items-center gap-7 text-[14.5px] font-semibold text-slate-500 sm:flex">
            <a href="#ilova" className="transition hover:text-slate-900">Ilova</a>
            <a href="#darajalar" className="transition hover:text-slate-900">Darajalar</a>
            <a href="#aloqa" className="transition hover:text-slate-900">Aloqa</a>
          </nav>
          <Link
            href={cabinet?.href ?? "/login"}
            className="ml-auto rounded-xl px-4 py-2.5 text-[14px] font-bold text-white transition active:scale-95 sm:ml-6"
            style={{ background: TEAL }}
          >
            {cabinet?.label ?? "Kirish"}
          </Link>
        </div>
      </header>

      {/* ── Bosh ekran ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(160deg, #f2f9fc 0%, #ffffff 55%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 md:grid-cols-2 md:items-center md:pb-24 md:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#e6f4f8] px-3.5 py-1.5 text-[12.5px] font-bold uppercase tracking-wider text-[#0b6a83]">
              A1 — C2 · Deutsch
            </span>
            <h1 className="mt-4 text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[52px]">
              Nemis tilini <span style={{ color: TEAL }}>telefoningizda</span> o&apos;rganing
            </h1>
            <p className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-slate-500">
              Darslar, uy vazifalari, lug&apos;at va natijalaringiz — hammasi bitta ilovada.
              O&apos;quv markazimiz o&apos;quvchilari uchun.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#ilova"
                className="rounded-2xl px-6 py-3.5 text-[15.5px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(14,116,144,0.9)] transition active:scale-[0.98]"
                style={{ background: TEAL }}
              >
                Ilovani olish
              </a>
              <Link
                href="/login"
                className="rounded-2xl border-2 border-slate-200 px-6 py-3.5 text-[15.5px] font-bold text-slate-700 transition hover:border-slate-300"
              >
                Tizimga kirish
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-medium text-slate-500">
              {["Tajribali ustozlar", "Kichik guruhlar", "Sertifikat"].map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <span style={{ color: TEAL }}><IcoCheck s={15} /></span>
                  {x}
                </li>
              ))}
            </ul>
          </div>

          {/* Telefon maketi */}
          <div className="relative mx-auto w-full max-w-[300px]">
            <div className="rounded-[42px] bg-slate-900 p-2.5 shadow-[0_40px_80px_-30px_rgba(9,32,53,0.7)]">
              <div className="relative overflow-hidden rounded-[34px] bg-[#e4edf3]">
                <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
                <div className="space-y-3 px-3.5 pb-6 pt-9">
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-extrabold leading-tight">Salom, Ezoza!</div>
                      <div className="text-[10.5px] text-slate-500">Bugungi darsingiz tayyor</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {["5", "12", "7", "1"].map((v, k) => (
                      <div key={k} className="rounded-xl bg-white/85 py-2 text-center">
                        <div className="text-[13px] font-extrabold">{v}</div>
                        <div className="text-[8px] text-slate-400">{["tanga", "yulduz", "seriya", "o'rin"][k]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl p-3 text-white" style={{ background: levelGradient(TEAL) }}>
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-white/70">Bugungi dars</div>
                    <div className="text-[16px] font-extrabold">Unit 1.1</div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                      <div className="h-full w-1/3 rounded-full bg-white" />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/85 p-3">
                    <div className="text-[12.5px] font-extrabold">Video va podkastlar</div>
                    <div className="mt-1 text-[10px] text-slate-400">Qiziqarli materiallar</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ilovani yuklab olish ── */}
      <section id="ilova" className="scroll-mt-20 px-5 py-14 md:py-20">
        <div
          className="mx-auto max-w-4xl overflow-hidden rounded-[32px] p-8 text-white shadow-[0_30px_60px_-30px_rgba(11,60,77,0.8)] md:p-12"
          style={{ background: "linear-gradient(150deg, #0b5d76 0%, #0e7490 45%, #17a2bf 100%)" }}
        >
          <div className="grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-center">
            <div>
              <h2 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] md:text-[36px]">
                O&apos;quvchi ilovasi
              </h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-white/80">
                Telefoningizga o&apos;rnating — darslar, uy vazifalari va ustoz bilan
                yozishma har doim qo&apos;l ostingizda bo&apos;ladi.
              </p>
              <ul className="mt-5 space-y-2 text-[14.5px] text-white/85">
                {["Bepul", "Ro'yxatdan o'tish shart emas — login o'quv markazidan beriladi", "Android va iPhone"].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 text-emerald-300"><IcoCheck s={14} /></span>
                    {x}
                  </li>
                ))}
              </ul>
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

      {/* ── Imkoniyatlar ── */}
      <section className="px-5 pb-14 md:pb-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">
            Ilovada nimalar bor
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_14px_34px_-24px_rgba(15,60,80,0.6)]">
                <div className="text-[28px] leading-none">{f.icon}</div>
                <h3 className="mt-3 text-[17px] font-extrabold tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Darajalar ── */}
      {levels.length > 0 ? (
        <section id="darajalar" className="scroll-mt-20 bg-slate-50 px-5 py-14 md:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">Darajalar</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-[15px] text-slate-500">
              Boshlang&apos;ichdan ona tili darajasigacha — har bosqichda darslar, mashqlar va yakuniy imtihon.
            </p>
            <div className="mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {levels.map((l) => (
                <div
                  key={l.id}
                  className="relative flex min-h-[128px] flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-[0_16px_36px_-22px_rgba(15,60,80,0.8)]"
                  style={l.bannerUrl ? { backgroundColor: "#12303f" } : { background: levelGradient(l.color) }}
                >
                  {l.bannerUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/25" />
                    </>
                  ) : null}
                  <span className="relative text-[26px] font-extrabold leading-none">{l.code}</span>
                  <span className="relative text-[15px] font-semibold text-white/85">{levelTitle(l, "uz")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Aloqa ── */}
      <footer id="aloqa" className="scroll-mt-20 border-t border-slate-100 px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="h-9 w-auto" />
          <p className="max-w-md text-[14.5px] leading-relaxed text-slate-500">
            Nemis tili o&apos;quv markazi. Kursga yozilish va savollar uchun bog&apos;laning.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="tel:+998995500055" className="rounded-2xl px-5 py-3 text-[14.5px] font-bold text-white" style={{ background: TEAL }}>
              +998 99 550 00 55
            </a>
            <a
              href="https://t.me/germaniyalive"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border-2 border-slate-200 px-5 py-3 text-[14.5px] font-bold text-slate-700"
            >
              Telegram
            </a>
          </div>
          <div className="text-[12.5px] text-slate-400">© {new Date().getFullYear()} Germaniya Live</div>
        </div>
      </footer>
    </div>
  );
}
