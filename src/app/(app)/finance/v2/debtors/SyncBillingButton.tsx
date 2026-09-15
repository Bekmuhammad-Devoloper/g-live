"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { fin } from "../_i18n";
import { syncBillingAction } from "../actions";

export default function SyncBillingButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {text && <span className="text-xs text-slate-500">{text}</span>}
      <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => { const r = await syncBillingAction(); setText(r.ok ? `${fin(locale, "done")}: +${r.data!.created}` : r.message); router.refresh(); })}>{fin(locale, "syncBilling")}</button>
    </div>
  );
}
