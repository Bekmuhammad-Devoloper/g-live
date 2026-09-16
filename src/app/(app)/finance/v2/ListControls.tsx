"use client";

// Ro'yxat boshqaruvi: qidiruv (ism) + sahifalash — URL query orqali (server sahifa o'qiydi). Oy tanlovi saqlanadi.
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { fin } from "./_i18n";

export default function ListControls({ locale: L, total, page, pageSize, q }: { locale: Locale; total: number; page: number; pageSize: number; q: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [text, setText] = useState(q);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const go = (next: { q?: string; page?: number }) => {
    const p = new URLSearchParams(sp.toString());
    if (next.q !== undefined) { if (next.q) p.set("q", next.q); else p.delete("q"); p.delete("page"); }
    if (next.page !== undefined) { if (next.page > 1) p.set("page", String(next.page)); else p.delete("page"); }
    router.push(`${path}?${p.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() }); }}>
        <input className="input w-56 py-1" placeholder={fin(L, "searchName")} value={text} onChange={(e) => setText(e.target.value)} aria-label={fin(L, "searchName")} />
        <button type="submit" className="btn-ghost px-2 py-1 text-xs">{fin(L, "search")}</button>
        {q && <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => { setText(""); go({ q: "" }); }}>×</button>}
      </form>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{total} · {fin(L, "page")} {page}/{pages}</span>
        <button type="button" className="btn-ghost px-2 py-1" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>{fin(L, "prev")}</button>
        <button type="button" className="btn-ghost px-2 py-1" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>{fin(L, "next")}</button>
      </div>
    </div>
  );
}
