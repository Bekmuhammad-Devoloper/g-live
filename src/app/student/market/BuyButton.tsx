"use client";

import { useState, useTransition } from "react";
import { ICON_GRADIENT } from "../_ui";
import { buyItem } from "./actions";

// Sotib olish tugmasi — tasdiqlash bilan (tanga qaytarilmaydi).

export default function BuyButton({
  id,
  title,
  price,
  affordable,
  soldOut,
}: {
  id: string;
  title: string;
  price: number;
  affordable: boolean;
  soldOut: boolean;
}) {
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const disabled = soldOut || !affordable || busy;

  const confirm = () => {
    setMsg(null);
    start(async () => {
      const r = await buyItem(id);
      setAsk(false);
      setMsg(r.ok ? { ok: true, text: "Buyurtma qabul qilindi" } : { ok: false, text: r.error ?? "Xatolik" });
    });
  };

  if (msg?.ok) {
    return (
      <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700">Buyurtma berildi</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {ask ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setAsk(false)}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12.5px] font-bold text-slate-500"
          >
            Yo'q
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
            style={{ background: ICON_GRADIENT }}
          >
            {busy ? "..." : "Tasdiqlash"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsk(true)}
          disabled={disabled}
          title={soldOut ? "Zaxira tugagan" : affordable ? title : "Tanga yetarli emas"}
          className={
            "rounded-xl px-3.5 py-1.5 text-[12.5px] font-bold transition " +
            (disabled ? "bg-slate-100 text-slate-400" : "text-white shadow-[0_6px_14px_rgba(14,116,144,0.25)]")
          }
          style={disabled ? undefined : { background: ICON_GRADIENT }}
        >
          {soldOut ? "Tugagan" : affordable ? "Olish" : price + " kerak"}
        </button>
      )}
      {msg && !msg.ok ? <span className="text-[11px] font-semibold text-rose-600">{msg.text}</span> : null}
    </div>
  );
}
