"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "../../_components/Icon";

export default function DateNav({ date }: { date: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const nav = (v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set("date", v); else p.delete("date");
    router.push(`/reports/branches-status?${p.toString()}`);
  };
  return (
    <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
      <Icon name="calendar" className="h-4 w-4 shrink-0 text-slate-400" />
      <input type="date" defaultValue={date} onChange={(e) => nav(e.target.value)} className="w-[130px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
    </div>
  );
}
