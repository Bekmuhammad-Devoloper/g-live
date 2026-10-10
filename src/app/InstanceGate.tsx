import type { BlockState } from "@/lib/instance";

// Markaz yopilganda (to'xtatilgan yoki litsenziya tugagan) va o'chirilgan modul sahifasida
// ko'rsatiladigan ekran. Ildiz maketdan chaqiriladi — sahifa kodi umuman bajarilmaydi.
export function BlockedScreen({ state, orgName }: { state: BlockState; orgName: string }) {
  const expired = state.reason === "expired";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl dark:bg-amber-500/10">🔒</div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">{orgName}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {expired
            ? `Tizimdan foydalanish muddati ${state.until ? state.until.split("-").reverse().join(".") : ""} da tugagan.`
            : "Tizimdan foydalanish vaqtincha to'xtatilgan."}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {expired ? "Muddatni uzaytirish uchun xizmat ko'rsatuvchi bilan bog'laning." : "Batafsil ma'lumot uchun xizmat ko'rsatuvchi bilan bog'laning."}
        </p>
        <p className="mt-4 text-xs text-slate-400">
          {expired ? "Срок использования системы истёк." : "Доступ к системе временно приостановлен."}
        </p>
      </div>
    </main>
  );
}

export function ModuleOffScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Bu bo'lim yoqilmagan</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bu bo'lim sizning tarifingizga kirmaydi. Yoqish uchun xizmat ko'rsatuvchi bilan bog'laning.</p>
        <a href="/" className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Bosh sahifa</a>
      </div>
    </main>
  );
}
