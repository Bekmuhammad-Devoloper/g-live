"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import BrandLogo, { type BrandView } from "@/app/BrandLogo";
import BrandedQr from "@/app/(app)/_components/BrandedQr";

export interface LabelRoom {
  id: string;
  name: string;
  capacity: number;
  branch: string | null;
  responsible: string | null;
  url: string;
  modules: string;
  size: number;
}

type Format = "a6" | "a5";

const INK = "#0f172a";
const MUTED = "#64748b";
const TEAL = "#0e7490";
const PANEL = "radial-gradient(130% 120% at 0% 0%, #1590ad 0%, #0b6a82 38%, #083a4a 78%, #062b37 100%)";

function splitName(name: string): { num: string | null; word: string } {
  const m = name.match(/\d+/);
  if (!m) return { num: null, word: name.trim() };
  const word = name.replace(m[0], " ").replace(/[#№\-–—_.]+/g, " ").replace(/\s+/g, " ").trim();
  return { num: m[0], word };
}

const numSize = (num: string, base: number) => `${num.length <= 1 ? base : num.length === 2 ? base * 0.82 : base * 0.6}mm`;
const wordSize = (name: string, base: number) => {
  const n = name.length;
  return `${n <= 6 ? base : n <= 10 ? base * 0.72 : n <= 16 ? base * 0.52 : base * 0.4}mm`;
};

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

const Svg = ({ d, size, color }: { d: ReactNode; size: string; color: string }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0 }} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICON = {
  seats: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.3a3.2 3.2 0 0 1 0 5.4M18 19a5.5 5.5 0 0 0-2.4-4.5" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  scan: <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M7.5 12h9" /></>,
};

function FlagStripe({ vertical }: { vertical?: boolean }) {
  const seg = (c: string) => <span style={{ flex: 1, background: c }} />;
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", [vertical ? "width" : "height"]: "1.8mm", flexShrink: 0 } as CSSProperties}>
      {seg("#1c1c1c")}{seg("#dd0000")}{seg("#ffce00")}
    </div>
  );
}

function QrCard({ r, mark, mm }: { r: LabelRoom; mark: string; mm: number }) {
  const b = (pos: CSSProperties): CSSProperties => ({ position: "absolute", width: "6mm", height: "6mm", borderColor: TEAL, borderStyle: "solid", borderWidth: 0, ...pos });
  return (
    <div style={{ position: "relative", padding: "3.5mm" }}>
      <span style={b({ top: 0, left: 0, borderTopWidth: "0.8mm", borderLeftWidth: "0.8mm", borderTopLeftRadius: "2.2mm" })} />
      <span style={b({ top: 0, right: 0, borderTopWidth: "0.8mm", borderRightWidth: "0.8mm", borderTopRightRadius: "2.2mm" })} />
      <span style={b({ bottom: 0, left: 0, borderBottomWidth: "0.8mm", borderLeftWidth: "0.8mm", borderBottomLeftRadius: "2.2mm" })} />
      <span style={b({ bottom: 0, right: 0, borderBottomWidth: "0.8mm", borderRightWidth: "0.8mm", borderBottomRightRadius: "2.2mm" })} />
      <div style={{ background: "#fff", borderRadius: "3.4mm", padding: "2.4mm", boxShadow: "0 1.2mm 4.5mm rgba(8,58,74,0.16), 0 0 0 0.25mm rgba(8,58,74,0.08)" }}>
        <BrandedQr modules={r.modules} size={r.size} px={Math.round(mm * 14)} logoSrc={mark} className="block" />
        <style>{`.gl-q${mm} canvas{width:${mm}mm;height:${mm}mm}`}</style>
      </div>
    </div>
  );
}

export default function RoomLabels({ rooms, brand, mark, locale }: { rooms: LabelRoom[]; brand: BrandView; mark: string; locale: Locale }) {
  const [format, setFormat] = useState<Format>("a6");
  const perPage = format === "a6" ? 4 : 2;
  const pages = chunk(rooms, perPage);
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const text = {
    room: T("Xona", "Кабинет", "Room", "Raum"),
    scan: T("Skanerlang", "Сканируйте", "Scan me", "Scannen"),
    scanLong: T("Dars jadvalini ko'rish uchun skanerlang", "Сканируйте, чтобы увидеть расписание", "Scan to see the class schedule", "Scannen für den Stundenplan"),
    sub: T("Bugungi darslar · mas'ul · haftalik jadval", "Занятия сегодня · ответственный · неделя", "Today's classes · person in charge · week", "Heutige Stunden · Verantwortlich · Woche"),
    seats: (n: number) => T(`${n} o'rin`, `${n} мест`, `${n} seats`, `${n} Plätze`),
    resp: T("Mas'ul", "Ответственный", "In charge", "Verantwortlich"),
  };

  return (
    <div className="min-h-dvh pb-10 print:pb-0" style={{ background: "#dfe5ea" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .gl-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; }
          .gl-sheet:last-child { break-after: auto; }
          .gl-cut { border-color: transparent !important; }
        }
        .gl-sheet, .gl-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        .gl-sheet { font-family: var(--font-sans); font-feature-settings: "tnum" 1, "cv11" 1; }
      `}</style>

      <div className="sticky top-0 z-10 border-b px-4 py-3 backdrop-blur print:hidden" style={{ background: "rgba(255,255,255,0.94)", borderColor: "#cbd5e1", color: INK }}>
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/rooms" className="rounded-lg border px-3 py-1.5 text-sm font-medium" style={{ borderColor: "#e2e8f0", color: "#475569" }}>← {T("Xonalar", "Кабинеты", "Rooms", "Räume")}</Link>
            <div>
              <div className="text-sm font-bold">{T("QR yorliqlar", "QR-таблички", "QR labels", "QR-Schilder")}</div>
              <div className="text-xs" style={{ color: MUTED }}>{rooms.length} {T("ta xona", "кабинетов", "rooms", "Räume")} · {pages.length} {T("varaq", "лист.", "sheets", "Blatt")} A4</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5" style={{ borderColor: "#e2e8f0" }}>
              {(["a6", "a5"] as Format[]).map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} className="rounded-md px-3 py-1.5 text-xs font-semibold transition" style={format === f ? { background: TEAL, color: "#fff" } : { color: MUTED }}>
                  {f === "a6" ? T("O'rta · A6 (4 ta)", "Средний · A6 (4 шт)", "Medium · A6 (4)", "Mittel · A6 (4)") : T("Katta · A5 (2 ta)", "Большой · A5 (2 шт)", "Large · A5 (2)", "Groß · A5 (2)")}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => window.print()} disabled={!rooms.length} className="rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50" style={{ background: TEAL, color: "#fff" }}>
              {T("Chop etish", "Печать", "Print", "Drucken")}
            </button>
          </div>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="py-24 text-center text-sm" style={{ color: MUTED }}>{T("Xona topilmadi", "Кабинеты не найдены", "No rooms found", "Keine Räume gefunden")}</div>
      ) : (
        pages.map((page, pi) => (
          <div
            key={pi}
            className="gl-sheet mx-auto mt-6 shadow-xl print:mt-0"
            style={{ width: "210mm", height: "297mm", background: "#fff", color: INK, display: "grid", gridTemplateColumns: format === "a6" ? "1fr 1fr" : "1fr", gridTemplateRows: "1fr 1fr" }}
          >
            {page.map((r) => (format === "a6"
              ? <LabelA6 key={r.id} r={r} brand={brand} mark={mark} text={text} />
              : <LabelA5 key={r.id} r={r} brand={brand} mark={mark} text={text} />))}
          </div>
        ))
      )}
    </div>
  );
}

type Text = { room: string; scan: string; scanLong: string; sub: string; seats: (n: number) => string; resp: string };

function Rings() {
  const ring = (size: string, top: string, right: string, op: number): CSSProperties => ({ position: "absolute", width: size, height: size, top, right, borderRadius: "50%", border: `0.5mm solid rgba(255,255,255,${op})` });
  return (
    <>
      <span style={ring("62mm", "-26mm", "-22mm", 0.09)} />
      <span style={ring("40mm", "-12mm", "-10mm", 0.07)} />
      <span style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 55%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.06) 62%, transparent 62%)" }} />
    </>
  );
}

function Pill({ children, size }: { children: ReactNode; size: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "1.2mm", borderRadius: "99mm", background: "rgba(255,255,255,0.14)", border: "0.25mm solid rgba(255,255,255,0.28)", padding: `${size * 0.32}mm ${size * 0.95}mm`, fontSize: `${size}mm`, fontWeight: 800, letterSpacing: `${size * 0.22}mm`, textTransform: "uppercase", color: "#fff" }}>
      <span style={{ width: `${size * 0.42}mm`, height: `${size * 0.42}mm`, borderRadius: "50%", background: "#ffce00" }} />
      {children}
    </span>
  );
}

function Title({ r, text, numBase, wordBase }: { r: LabelRoom; text: Text; numBase: number; wordBase: number }) {
  const { num, word } = splitName(r.name);
  if (!num) {
    return <div style={{ fontSize: wordSize(r.name, wordBase * 2.2), fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.4mm", wordBreak: "break-word" }}>{r.name}</div>;
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2.5mm" }}>
      <span style={{ fontSize: numSize(num, numBase), fontWeight: 900, lineHeight: 0.78, letterSpacing: "-1.2mm" }}>{num}</span>
      <span style={{ paddingBottom: `${numBase * 0.06}mm`, display: "flex", flexDirection: "column", gap: "0.6mm", minWidth: 0 }}>
        <span style={{ fontSize: `${wordBase}mm`, fontWeight: 800, letterSpacing: `${wordBase * 0.14}mm`, textTransform: "uppercase", lineHeight: 1, wordBreak: "break-word" }}>{word || text.room}</span>
        <span style={{ width: `${wordBase * 2.2}mm`, height: "0.7mm", borderRadius: "1mm", background: "#ffce00" }} />
      </span>
    </div>
  );
}

function LabelA6({ r, brand, mark, text }: { r: LabelRoom; brand: BrandView; mark: string; text: Text }) {
  return (
    <div className="gl-cut" style={{ display: "flex", flexDirection: "column", overflow: "hidden", border: "0.25mm dashed #cbd5e1", background: "#fff" }}>
      <div style={{ position: "relative", overflow: "hidden", background: PANEL, color: "#fff", padding: "6.5mm 7mm 7mm" }}>
        <Rings />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BrandLogo brand={brand} variant="dark" className="h-[8.5mm] w-auto max-w-[52mm] object-contain" textClassName="text-[4.5mm] font-extrabold text-white" />
          {!splitName(r.name).num && <Pill size={2.5}>{text.room}</Pill>}
        </div>
        <div style={{ position: "relative", marginTop: "7mm" }}>
          <Title r={r} text={text} numBase={34} wordBase={5.6} />
        </div>
      </div>
      <FlagStripe />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3mm 6mm 2mm" }}>
        <div className="gl-q50"><QrCard r={r} mark={mark} mm={50} /></div>
        <div style={{ marginTop: "2.2mm", display: "flex", alignItems: "center", gap: "1.4mm", fontSize: "3.4mm", fontWeight: 800, color: INK }}>
          <Svg d={ICON.scan} size="4mm" color={TEAL} />
          {text.scanLong}
        </div>
        <div style={{ marginTop: "0.8mm", fontSize: "2.6mm", fontWeight: 500, color: MUTED }}>{text.sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3mm", borderTop: "0.3mm solid #e2e8f0", background: "#f8fafc", padding: "2.8mm 7mm", fontSize: "2.9mm", fontWeight: 600, color: "#334155" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "1.2mm", minWidth: 0 }}>
          {r.capacity > 0 && <><Svg d={ICON.seats} size="3.6mm" color={TEAL} /><span>{text.seats(r.capacity)}</span></>}
          {r.branch && <><Svg d={ICON.pin} size="3.6mm" color={TEAL} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.branch}</span></>}
        </span>
        {r.responsible && (
          <span style={{ display: "flex", alignItems: "center", gap: "1.2mm", minWidth: 0 }}>
            <Svg d={ICON.user} size="3.6mm" color={TEAL} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.responsible}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function LabelA5({ r, brand, mark, text }: { r: LabelRoom; brand: BrandView; mark: string; text: Text }) {
  const meta = (icon: ReactNode, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "2mm", fontSize: "3.7mm", fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>
      <span style={{ display: "grid", placeItems: "center", width: "7mm", height: "7mm", borderRadius: "2mm", background: "rgba(255,255,255,0.12)" }}><Svg d={icon} size="4mm" color="#ffffff" /></span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
  return (
    <div className="gl-cut" style={{ display: "flex", overflow: "hidden", border: "0.25mm dashed #cbd5e1", background: "#fff" }}>
      <div style={{ position: "relative", overflow: "hidden", width: "104mm", flexShrink: 0, background: PANEL, color: "#fff", padding: "10mm 9mm 9mm 11mm", display: "flex", flexDirection: "column" }}>
        <Rings />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BrandLogo brand={brand} variant="dark" className="h-[11mm] w-auto max-w-[62mm] object-contain" textClassName="text-[6mm] font-extrabold text-white" />
        </div>
        {!splitName(r.name).num && <div style={{ position: "relative", marginTop: "9mm" }}><Pill size={3}>{text.room}</Pill></div>}
        <div style={{ position: "relative", marginTop: splitName(r.name).num ? "12mm" : "5mm" }}>
          <Title r={r} text={text} numBase={52} wordBase={7.4} />
        </div>
        <div style={{ position: "relative", marginTop: "auto", display: "flex", flexDirection: "column", gap: "2.2mm" }}>
          {r.capacity > 0 && meta(ICON.seats, text.seats(r.capacity))}
          {r.branch && meta(ICON.pin, r.branch)}
          {r.responsible && meta(ICON.user, `${text.resp}: ${r.responsible}`)}
        </div>
      </div>
      <FlagStripe vertical />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6mm", background: "radial-gradient(120% 100% at 50% 0%, #f2fafc 0%, #ffffff 60%)" }}>
        <div style={{ fontSize: "3mm", fontWeight: 800, letterSpacing: "0.9mm", textTransform: "uppercase", color: TEAL }}>{text.scan}</div>
        <div className="gl-q66" style={{ marginTop: "2.5mm" }}><QrCard r={r} mark={mark} mm={66} /></div>
        <div style={{ marginTop: "3mm", display: "flex", alignItems: "center", gap: "1.6mm", fontSize: "3.9mm", fontWeight: 800, color: INK, textAlign: "center" }}>
          <Svg d={ICON.scan} size="4.6mm" color={TEAL} />
          {text.scanLong}
        </div>
        <div style={{ marginTop: "1mm", fontSize: "3mm", fontWeight: 500, color: MUTED }}>{text.sub}</div>
      </div>
    </div>
  );
}
