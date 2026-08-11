"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "../../_components/Icon";

export default function DateRangeNav({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const nav = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set(k, v);
    router.push(`/reports/teacher-performance?${p.toString()}`);
  };
  return (
    <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
      <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
      <input type="date" defaultValue={from} onChange={(e) => nav("from", e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
      <span className="text-slate-300">–</span>
      <input type="date" defaultValue={to} onChange={(e) => nav("to", e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
    </div>
  );
}
