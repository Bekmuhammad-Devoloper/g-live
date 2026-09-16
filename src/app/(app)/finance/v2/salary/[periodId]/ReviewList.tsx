"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@/lib/constants";
import { Card } from "../../../../_components/ui";
import { fin } from "../../_i18n";
import { postEarningAction, rejectEarningAction } from "../../actions";

export default function ReviewList({ locale: L, enabled, rows }: { locale: Locale; enabled: boolean; rows: { id: string; type: string; amount: number; reason: string; student: string | null; group: string | null; month: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card className="mb-4 border-amber-200 bg-amber-50/40">
      <h3 className="mb-2 text-sm font-semibold text-amber-800">{fin(L, "needsReview")} ({rows.length})</h3>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{r.student ?? "—"}{r.group ? ` · ${r.group}` : ""} · {r.month} · <span className="text-[11px] text-amber-700">{r.reason}</span></span>
            <span className="flex items-center gap-2"><span className="tabular-nums font-semibold">{formatMoney(r.amount, L)}</span>
              {enabled && (
                <>
                  <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => { const reason = window.prompt(fin(L, "reason")) ?? ""; if (reason.trim().length >= 3) start(async () => { const x = await postEarningAction(r.id, reason); setMsg(x.ok ? fin(L, "done") : x.message); router.refresh(); }); }}>{fin(L, "post")}</button>
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => { const reason = window.prompt(fin(L, "rejectReason")) ?? ""; if (reason.trim().length >= 3) start(async () => { const x = await rejectEarningAction(r.id, reason); setMsg(x.ok ? fin(L, "done") : x.message); router.refresh(); }); }}>{fin(L, "reject")}</button>
                </>
              )}
              </span>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
    </Card>
  );
}
