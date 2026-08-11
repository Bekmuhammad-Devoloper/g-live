import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10">
      {/* Fon bezaklari */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="mx-auto mb-3 h-auto w-64 max-w-full object-contain" />
          <p className="mt-1 text-sm text-slate-500">O'quv markazini boshqarish tizimi</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">© 2026 Germaniya Live</p>
      </div>
    </div>
  );
}
