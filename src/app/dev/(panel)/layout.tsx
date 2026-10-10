import Link from "next/link";
import { requireDev } from "@/lib/devpanel/auth";
import { logoutAction } from "../actions";
import DevNav from "./DevNav";

export default async function DevPanelLayout({ children }: { children: React.ReactNode }) {
  const dev = await requireDev();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a1020]/90 backdrop-blur md:flex">
        <Link href="/dev" className="flex flex-col gap-2 border-b border-white/[0.06] px-6 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Germaniya Live" className="h-10 w-auto self-start object-contain" />
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e3262b]/15 to-[#f6b51e]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-300">
            Dev panel
          </span>
        </Link>
        <DevNav />
        <div className="mt-auto border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e3262b] to-[#f6b51e] text-sm font-bold text-white">
              {dev.email.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-200">{dev.email}</div>
              <form action={logoutAction}>
                <button type="submit" className="text-[11px] font-semibold text-slate-500 transition hover:text-orange-300">Chiqish</button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0a1020]/90 px-4 backdrop-blur md:hidden">
          <Link href="/dev">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-dark.png" alt="Germaniya Live" className="h-7 w-auto object-contain" />
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/dev/centers/new" className="font-semibold text-orange-300">+ Markaz</Link>
            <Link href="/dev/audit" className="text-slate-400">Jurnal</Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
