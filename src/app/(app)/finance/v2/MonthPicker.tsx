"use client";

import { useRouter, usePathname } from "next/navigation";

// `?ym=YYYY-MM` orqali oy tanlash (server sahifa qayta yuklanadi)
export default function MonthPicker({ value }: { value: string }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <input
      type="month"
      className="input w-auto"
      value={value}
      onChange={(e) => { if (e.target.value) router.push(`${path}?ym=${e.target.value}`); }}
    />
  );
}
