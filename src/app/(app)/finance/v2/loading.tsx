// Finance V2 — yuklanish holati (server sahifalar uchun umumiy skelet)
export default function FinanceLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-7 w-64 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
      </div>
      <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}
