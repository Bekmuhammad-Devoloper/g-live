"use client";

import DateInput from "@/app/(app)/_components/DateInput";
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
      <DateInput defaultValue={from} onChange={(e) => nav("from", e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
      <span className="text-slate-300">–</span>
      <DateInput defaultValue={to} onChange={(e) => nav("to", e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
    </div>
  );
}
