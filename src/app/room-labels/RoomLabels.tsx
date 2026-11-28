"use client";

import { useState } from "react";
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

const nameSize = (name: string, big: boolean) => {
  const n = name.length;
  const s = n <= 5 ? 24 : n <= 9 ? 17 : n <= 14 ? 12 : 9.5;
  return `${big ? s * 1.15 : s}mm`;
};

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

export default function RoomLabels({ rooms, brand, mark, locale }: { rooms: LabelRoom[]; brand: BrandView; mark: string; locale: Locale }) {
  const [format, setFormat] = useState<Format>("a6");
  const perPage = format === "a6" ? 4 : 2;
  const pages = chunk(rooms, perPage);
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const scan = T("Dars jadvalini ko'rish uchun skanerlang", "Сканируйте, чтобы увидеть расписание", "Scan to see the schedule", "Scannen für den Stundenplan");

  return (
    <div className="min-h-dvh bg-slate-200 pb-10 print:bg-white print:pb-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .gl-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; }
          .gl-sheet:last-child { break-after: auto; }
        }
        .gl-sheet, .gl-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="sticky top-0 z-10 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/rooms" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">← {T("Xonalar", "Кабинеты", "Rooms", "Räume")}</Link>
            <div>
              <div className="text-sm font-bold text-slate-800">{T("QR yorliqlar", "QR-таблички", "QR labels", "QR-Schilder")}</div>
              <div className="text-xs text-slate-500">{rooms.length} {T("ta xona", "кабинетов", "rooms", "Räume")} · {pages.length} {T("varaq", "лист.", "sheets", "Blatt")} A4</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(["a6", "a5"] as Format[]).map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${format === f ? "bg-[#0e7490] text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {f === "a6" ? T("O'rta · A6 (4 ta)", "Средний · A6 (4 шт)", "Medium · A6 (4)", "Mittel · A6 (4)") : T("Katta · A5 (2 ta)", "Большой · A5 (2 шт)", "Large · A5 (2)", "Groß · A5 (2)")}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => window.print()} disabled={!rooms.length} className="rounded-lg bg-[#0e7490] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5d73] disabled:opacity-50">
              {T("Chop etish", "Печать", "Print", "Drucken")}
            </button>
          </div>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="py-24 text-center text-sm text-slate-500">{T("Xona topilmadi", "Кабинеты не найдены", "No rooms found", "Keine Räume gefunden")}</div>
      ) : (
        pages.map((page, pi) => (
          <div key={pi} className="gl-sheet mx-auto mt-6 bg-white shadow-xl print:mt-0" style={{ width: "210mm", height: "297mm", display: "grid", gridTemplateColumns: format === "a6" ? "1fr 1fr" : "1fr", gridTemplateRows: "1fr 1fr" }}>
            {page.map((r) => (format === "a6" ? <LabelA6 key={r.id} r={r} brand={brand} mark={mark} scan={scan} locale={locale} /> : <LabelA5 key={r.id} r={r} brand={brand} mark={mark} scan={scan} locale={locale} />))}
          </div>
        ))
      )}
    </div>
  );
}

function Meta({ r, locale }: { r: LabelRoom; locale: Locale }) {
  const parts = [
    r.capacity > 0 ? tr(locale, { uz: `${r.capacity} o'rin`, ru: `${r.capacity} мест`, en: `${r.capacity} seats`, de: `${r.capacity} Plätze` }) : null,
    r.branch,
  ].filter(Boolean);
  return <>{parts.join(" · ")}</>;
}

function LabelA6({ r, brand, mark, scan, locale }: { r: LabelRoom; brand: BrandView; mark: string; scan: string; locale: Locale }) {
  return (
    <div className="relative flex flex-col overflow-hidden" style={{ border: "0.3mm dashed #cbd5e1", padding: "6mm 7mm 0" }}>
      <div className="flex items-center justify-between">
        <BrandLogo brand={brand} variant="light" className="h-[10mm] w-auto max-w-[58mm] object-contain" textClassName="text-[4.5mm] font-extrabold text-slate-900" />
        <span className="rounded-full font-bold uppercase text-white" style={{ background: "#0e7490", fontSize: "2.8mm", letterSpacing: "0.4mm", padding: "1mm 3mm" }}>{tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room", de: "Raum" })}</span>
      </div>
      <div className="mt-[3mm] text-center font-black leading-none text-slate-900" style={{ fontSize: nameSize(r.name, false), wordBreak: "break-word" }}>{r.name}</div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <BrandedQr modules={r.modules} size={r.size} px={760} logoSrc={mark} className="block h-[62mm] w-[62mm]" />
        <div className="mt-[2mm] text-center font-semibold text-slate-600" style={{ fontSize: "3.2mm" }}>{scan}</div>
      </div>
      <div className="-mx-[7mm] mt-[3mm] flex items-center justify-between gap-2 text-white" style={{ background: "linear-gradient(90deg,#0e7490,#0b3c4d)", padding: "2.6mm 7mm", fontSize: "3mm" }}>
        <span className="truncate font-semibold"><Meta r={r} locale={locale} /></span>
        {r.responsible && <span className="truncate opacity-90">{tr(locale, { uz: "Mas'ul", ru: "Отв.", en: "Resp.", de: "Verantw." })}: {r.responsible}</span>}
      </div>
    </div>
  );
}

function LabelA5({ r, brand, mark, scan, locale }: { r: LabelRoom; brand: BrandView; mark: string; scan: string; locale: Locale }) {
  return (
    <div className="relative flex flex-col overflow-hidden" style={{ border: "0.3mm dashed #cbd5e1" }}>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ padding: "8mm 8mm 6mm 11mm" }}>
          <BrandLogo brand={brand} variant="light" className="h-[12mm] w-auto max-w-[80mm] self-start object-contain" textClassName="text-[6mm] font-extrabold text-slate-900" />
          <span className="mt-[8mm] self-start rounded-full font-bold uppercase text-white" style={{ background: "#0e7490", fontSize: "3.6mm", letterSpacing: "0.5mm", padding: "1.2mm 3.8mm" }}>{tr(locale, { uz: "Xona", ru: "Кабинет", en: "Room", de: "Raum" })}</span>
          <div className="mt-[3mm] font-black leading-none text-slate-900" style={{ fontSize: nameSize(r.name, true), wordBreak: "break-word" }}>{r.name}</div>
          <div className="mt-[5mm] font-semibold text-slate-500" style={{ fontSize: "4.2mm" }}><Meta r={r} locale={locale} /></div>
          {r.responsible && <div className="mt-[1.5mm] text-slate-600" style={{ fontSize: "4mm" }}>{tr(locale, { uz: "Mas'ul", ru: "Ответственный", en: "Responsible", de: "Verantwortlich" })}: <b>{r.responsible}</b></div>}
        </div>
        <div className="flex shrink-0 items-center justify-center" style={{ width: "92mm", background: "linear-gradient(135deg,#f0f9fb,#e2f2f6)" }}>
          <BrandedQr modules={r.modules} size={r.size} px={960} logoSrc={mark} className="block h-[80mm] w-[80mm]" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 text-white" style={{ background: "linear-gradient(90deg,#0e7490,#0b3c4d)", padding: "3.4mm 11mm", fontSize: "3.8mm" }}>
        <span className="font-semibold">{scan}</span>
        <span className="shrink-0 opacity-80">→</span>
      </div>
    </div>
  );
}
