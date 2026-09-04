"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { StudentStrings } from "../_i18n";
import { CoinGold, ICON_GRADIENT, TEAL } from "../_ui";
import { buyItem } from "./actions";

// Do'kon kartochkasi: rasm, narx yorlig'i, zaxira va sotib olish tugmasi.
// Rasm qo'yilmagan sovg'a uchun nomiga qarab mos belgi va rang tanlanadi —
// bo'sh kulrang katak o'rniga jonli vitrina bo'lsin.
// Kartaning RAMKASI shisha (`.gl-glass`), rasm maydoni esa qattiq qoladi —
// sovg'a surati ostidan fon ko'rinib ketmasin.
//
// Kartochka BOSILADI: plitkada rasm qirqilgan, tavsif esa ikki qatorga
// kesilgan bo'ladi; tanga yetmasa tugma ham o'chiq turadi va sovg'ani
// umuman ko'rib bo'lmasdi. Bosilganda to'liq ma'lumot oynasi ochiladi.

export type VItem = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number | null;
  imageUrl: string | null;
};

type Theme = { bg: string; soft: string };

const THEMES: Theme[] = [
  { bg: "linear-gradient(140deg,#0ea5e9,#0369a1)", soft: "#e0f2fe" },
  { bg: "linear-gradient(140deg,#f59e0b,#b45309)", soft: "#fef3c7" },
  { bg: "linear-gradient(140deg,#10b981,#047857)", soft: "#d1fae5" },
  { bg: "linear-gradient(140deg,#8b5cf6,#5b21b6)", soft: "#ede9fe" },
  { bg: "linear-gradient(140deg,#f43f5e,#9f1239)", soft: "#ffe4e6" },
  { bg: "linear-gradient(140deg,#14b8a6,#0f766e)", soft: "#ccfbf1" },
];

// Nomi bo'yicha belgi — ustoz qanday sovg'a qo'shsa ham mos tushsin
function glyphFor(title: string) {
  const s = title.toLowerCase();
  if (/ruchka|qalam|pen/.test(s)) return "pen";
  if (/bloknot|daftar|kitob|notebook/.test(s)) return "book";
  if (/kofe|choy|shirin|coffee|kek/.test(s)) return "cup";
  if (/ramka|sertifikat|diplom/.test(s)) return "frame";
  if (/dars|lesson|kurs/.test(s)) return "ticket";
  if (/futbolka|kiyim|shirt|sumka/.test(s)) return "shirt";
  return "gift";
}

function Glyph({ kind, s = 46 }: { kind: string; s?: number }) {
  const P = { fill: "none", stroke: "white", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      {kind === "pen" && <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 2.8L8 18.8 4 20ZM14.5 6.5l3 3" />}
      {kind === "book" && <path d="M5 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5ZM8.5 8.5h6M8.5 12h6" />}
      {kind === "cup" && <path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8ZM16 9.5h1.6a2.4 2.4 0 0 1 0 4.8H16M6.5 4.5v1.5M10 3.8v2.2M13.5 4.5v1.5" />}
      {kind === "frame" && <path d="M4.5 5h15v14h-15zM8 15l3-3.5 2.2 2.5 2-2.3L17 15M9 9.2h.01" />}
      {kind === "ticket" && <path d="M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.2a2.3 2.3 0 0 0 0 4.6v1.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.2a2.3 2.3 0 0 0 0-4.6V8.5ZM12 8v2M12 14v2" />}
      {kind === "shirt" && <path d="M8.5 4 5 6l1.5 3.5 1.5-.7V20h8V8.8l1.5.7L19 6l-3.5-2c-.8 1.3-2 2-3.5 2s-2.7-.7-3.5-2Z" />}
      {kind === "gift" && <path d="M4.5 10.5h15V20h-15zM3.8 6.8h16.4v3.7H3.8zM12 6.8V20M12 6.8C10.6 4.2 9.2 3.5 8 4.2c-1.4.8-.9 2.6 4 2.6ZM12 6.8c1.4-2.6 2.8-3.3 4-2.6 1.4.8.9 2.6-4 2.6Z" />}
    </svg>
  );
}

export default function ItemCard({
  item,
  balance,
  t,
  index,
}: {
  item: VItem;
  balance: number;
  t: StudentStrings;
  index: number;
}) {
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);

  const theme = THEMES[index % THEMES.length];
  const soldOut = item.stock !== null && item.stock <= 0;
  const affordable = balance >= item.price;
  const blocked = soldOut || !affordable;

  const confirm = () => {
    setErr(null);
    start(async () => {
      const r = await buyItem(item.id);
      setAsk(false);
      if (r.ok) setDone(true);
      else setErr(r.error ?? "!");
    });
  };

  return (
    <div className="gl-glass overflow-hidden rounded-[20px]">
      {/* Vitrina — bosilsa to'liq ma'lumot ochiladi */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={item.title}
        className="relative block aspect-[4/3] w-full"
        style={{ background: item.imageUrl ? undefined : theme.bg }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center opacity-90">
            <Glyph kind={glyphFor(item.title)} />
          </span>
        )}

        {/* Narx yorlig'i */}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-[3px] shadow-sm">
          <CoinGold s={15} />
          <span className="text-[12px] font-extrabold text-slate-800">{item.price}</span>
        </span>

        {item.stock !== null && !soldOut ? (
          <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-[3px] text-[10.5px] font-bold text-white">
            {item.stock} {t.left}
          </span>
        ) : null}

        {soldOut ? (
          <span className="absolute inset-0 grid place-items-center bg-slate-900/45 text-[13px] font-extrabold uppercase tracking-wide text-white">
            {t.soldOut}
          </span>
        ) : null}
      </button>

      {/* Matn */}
      <div className="p-3">
        <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
          <div className="line-clamp-2 min-h-[36px] text-[14px] font-extrabold leading-tight text-slate-900">{item.title}</div>
          {item.description ? (
            <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-slate-500">{item.description}</div>
          ) : null}
        </button>

        {/* Amal */}
        <div className="mt-2.5">
          {done ? (
            <div className="grid min-h-[44px] place-items-center rounded-xl bg-emerald-50 px-2 text-center text-[12.5px] font-bold text-emerald-700">{t.ordered}</div>
          ) : ask ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAsk(false)}
                className="min-h-[44px] rounded-xl bg-slate-100 px-3 py-2 text-[12.5px] font-bold text-slate-500"
              >
                {t.no}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="min-h-[44px] flex-1 rounded-xl py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
                style={{ background: ICON_GRADIENT }}
              >
                {busy ? "…" : t.confirm}
              </button>
            </div>
          ) : (
            <button
              type="button"
              // Tanga yetmasa ham bosiladi — sovg'ani ko'rish uchun oyna ochiladi
              onClick={() => (blocked ? setOpen(true) : setAsk(true))}
              className={
                "min-h-[44px] w-full rounded-xl py-2 text-[12.5px] font-bold transition " +
                (blocked ? "bg-slate-100 text-slate-500" : "text-white shadow-[0_6px_14px_rgba(14,116,144,0.22)] active:translate-y-[1px]")
              }
              style={blocked ? undefined : { background: ICON_GRADIENT }}
            >
              {soldOut ? t.soldOut : affordable ? t.buy : item.price - balance + " " + t.needed}
            </button>
          )}
          {err ? <div className="mt-1 text-center text-[11px] font-semibold text-rose-600">{err}</div> : null}
        </div>
      </div>

      {open ? (
        <DetailSheet
          item={item}
          t={t}
          theme={theme}
          balance={balance}
          soldOut={soldOut}
          affordable={affordable}
          done={done}
          busy={busy}
          err={err}
          onBuy={confirm}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ───────────── To'liq ma'lumot oynasi (pastdan chiqadi) ─────────────

function DetailSheet({
  item, t, theme, balance, soldOut, affordable, done, busy, err, onBuy, onClose,
}: {
  item: VItem;
  t: StudentStrings;
  theme: Theme;
  balance: number;
  soldOut: boolean;
  affordable: boolean;
  done: boolean;
  busy: boolean;
  err: string | null;
  onBuy: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!mounted) return null;

  const missing = Math.max(0, item.price - balance);
  const pct = item.price > 0 ? Math.max(0, Math.min(100, Math.round((balance / item.price) * 100))) : 100;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white pb-7 shadow-[0_-10px_30px_rgba(19,78,94,0.22)]"
      >
        <div className="sticky top-0 z-10 flex justify-center bg-white pb-1 pt-3">
          <span className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Rasm — plitkadagidan katta, to'liq ko'rinadi */}
        <div className="relative aspect-[4/3] w-full" style={{ background: item.imageUrl ? undefined : theme.bg }}>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center opacity-90">
              <Glyph kind={glyphFor(item.title)} s={78} />
            </span>
          )}
          {soldOut ? (
            <span className="absolute inset-0 grid place-items-center bg-slate-900/45 text-[15px] font-extrabold uppercase tracking-wide text-white">
              {t.soldOut}
            </span>
          ) : null}
        </div>

        <div className="px-5 pt-4">
          <h2 className="text-[20px] font-extrabold leading-tight text-slate-900">{item.title}</h2>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5">
              <CoinGold s={17} />
              <span className="text-[14px] font-extrabold text-slate-800">{item.price}</span>
            </span>
            {item.stock !== null && !soldOut ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                {item.stock} {t.left}
              </span>
            ) : null}
          </div>

          {/* To'liq tavsif — plitkada u ikki qatorga kesilgan edi */}
          {item.description ? (
            <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-600">{item.description}</p>
          ) : null}

          {/* Tanga yetmasa — qancha qolgani ko'rinadi */}
          {!affordable && !soldOut ? (
            <div className="mt-4 rounded-2xl bg-[#eef6fa] p-3.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-semibold text-slate-600">
                  {t.yourBalance} {balance} · {t.needed} {missing}
                </span>
                <span className="shrink-0 font-extrabold" style={{ color: TEAL }}>{pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: TEAL }} />
              </div>
            </div>
          ) : null}

          {err ? <p className="mt-3 text-center text-[12.5px] font-semibold text-rose-600">{err}</p> : null}

          {/* Amal */}
          <div className="mt-4 flex gap-2">
            {done ? (
              <div className="grid min-h-[48px] flex-1 place-items-center rounded-2xl bg-emerald-50 text-[14px] font-bold text-emerald-700">
                {t.ordered}
              </div>
            ) : ask ? (
              <>
                <button
                  type="button"
                  onClick={() => setAsk(false)}
                  className="min-h-[48px] rounded-2xl bg-slate-100 px-5 text-[14px] font-bold text-slate-500"
                >
                  {t.no}
                </button>
                <button
                  type="button"
                  onClick={onBuy}
                  disabled={busy}
                  className="min-h-[48px] flex-1 rounded-2xl text-[14px] font-bold text-white disabled:opacity-60"
                  style={{ background: ICON_GRADIENT }}
                >
                  {busy ? "…" : t.confirm}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[48px] rounded-2xl bg-slate-100 px-5 text-[14px] font-bold text-slate-500"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => setAsk(true)}
                  disabled={soldOut || !affordable}
                  className={
                    "min-h-[48px] flex-1 rounded-2xl text-[14px] font-bold transition " +
                    (soldOut || !affordable ? "bg-slate-100 text-slate-400" : "text-white active:translate-y-[1px]")
                  }
                  style={soldOut || !affordable ? undefined : { background: ICON_GRADIENT }}
                >
                  {soldOut ? t.soldOut : affordable ? t.buy : `${missing} ${t.needed}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
