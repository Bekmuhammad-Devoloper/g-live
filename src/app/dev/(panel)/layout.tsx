import Link from "next/link";
import { requireDev } from "@/lib/devpanel/auth";
import { logoutAction } from "../actions";
import DevNav from "./DevNav";

export default async function DevPanelLayout({ children }: { children: React.ReactNode }) {
  const dev = await requireDev();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 text-slate-300 md:flex">
        <Link href="/dev" className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-900">GL</span>
          <span>
            <span className="block text-sm font-bold text-white">Dev panel</span>
            <span className="block text-[11px] text-slate-400">Markazlar boshqaruvi</span>
          </span>
        </Link>
        <DevNav />
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="truncate text-xs text-slate-400">{dev.email}</div>
          <form action={logoutAction}>
            <button type="submit" className="mt-2 text-xs font-semibold text-slate-300 hover:text-white">Chiqish →</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <Link href="/dev" className="font-bold">Dev panel</Link>
          <div className="flex gap-3 text-sm">
            <Link href="/dev/centers/new" className="font-semibold text-slate-700">+ Markaz</Link>
            <Link href="/dev/audit" className="text-slate-500">Jurnal</Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
