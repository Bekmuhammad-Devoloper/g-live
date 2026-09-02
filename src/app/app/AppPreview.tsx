import { levelGradient } from "@/lib/levelColor";

// Ilova ko'rinishi — telefon ramkasi emas, ilovaning haqiqiy
// kartochkalari biroz burchak bilan qatlanadi. Ramka chizish har doim
// "maket"dek ko'rinardi; kartochkalarning o'zi esa mahsulotni ko'rsatadi.

const TEAL = "#0e7490";

export default function AppPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] select-none">
      {/* orqa fondagi yumshoq nur */}
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-[80px] bg-gradient-to-br from-[#17a2bf]/20 via-transparent to-[#7c3aed]/15 blur-3xl" />

      {/* ── Salomlashish ── */}
      <div className="relative z-30 ml-auto w-[86%] rotate-[-2deg] rounded-[24px] border border-slate-900/[0.05] bg-white p-4 shadow-[0_24px_50px_-24px_rgba(15,60,80,0.45)]">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold leading-tight tracking-[-0.01em]">Salom, Ezoza!</div>
            <div className="text-[12px] leading-tight text-slate-400">Bugungi darsingiz tayyor</div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#f97316" aria-hidden>
              <path d="M12 2.5c.5 3-1 4.6-2.6 6.2C7.7 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.2-1-4-2.2-5.6C14.4 7.5 13 5.5 12 2.5Z" />
            </svg>
            <span className="text-[12.5px] font-extrabold leading-none text-orange-600">7</span>
          </span>
        </div>
      </div>

      {/* ── Bugungi dars ── */}
      <div
        className="relative z-20 -mt-3 w-[94%] rotate-[1.4deg] rounded-[26px] p-5 text-white shadow-[0_30px_60px_-28px_rgba(11,60,77,0.85)]"
        style={{ background: levelGradient(TEAL) }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Bugungi dars</div>
            <div className="mt-1 text-[24px] font-extrabold leading-tight tracking-[-0.025em]">Unit 1.1</div>
            <div className="mt-0.5 text-[13px] text-white/70">Begrüßung und Vorstellung</div>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M8 5.2v13.6L19 12 8 5.2Z" />
            </svg>
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full w-[38%] rounded-full bg-white" />
          </div>
          <span className="text-[12.5px] font-extrabold">38%</span>
        </div>
      </div>

      {/* ── Ballar ── */}
      <div className="relative z-30 -mt-3 ml-auto w-[88%] rotate-[-1.2deg] rounded-[24px] border border-slate-900/[0.05] bg-white p-3.5 shadow-[0_24px_50px_-24px_rgba(15,60,80,0.45)]">
        <div className="grid grid-cols-4 gap-2">
          {[
            { v: "45", l: "tanga", c: "text-[#0e7490]" },
            { v: "12", l: "yulduz", c: "text-amber-500" },
            { v: "7", l: "seriya", c: "text-orange-500" },
            { v: "3", l: "o'rin", c: "text-violet-500" },
          ].map((x) => (
            <div key={x.l} className="text-center">
              <div className={`text-[18px] font-extrabold leading-none tracking-[-0.02em] ${x.c}`}>{x.v}</div>
              <div className="mt-1 text-[10px] font-semibold text-slate-400">{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ustoz bilan yozishma ── */}
      <div className="relative z-20 -mt-2.5 w-[80%] rotate-[1.8deg] rounded-[24px] border border-slate-900/[0.05] bg-white p-4 shadow-[0_24px_50px_-24px_rgba(15,60,80,0.45)]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4.2 20.4l1.5-3.7A6.9 6.9 0 0 1 3.5 12.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-extrabold leading-tight">Ustoz javob berdi</div>
            <div className="mt-0.5 truncate text-[12px] text-slate-400">Vazifangiz qabul qilindi 👍</div>
          </div>
        </div>
      </div>
    </div>
  );
}
