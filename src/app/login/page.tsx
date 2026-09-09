import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { LOCALES, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import LoginForm from "./LoginForm";

// Kirish sahifasida sessiya (va User.locale) yo'q — til brauzerning
// Accept-Language sarlavhasidan olinadi: birinchi mos kelgan til, aks holda "uz".
async function browserLocale(): Promise<Locale> {
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase() as Locale;
    if (LOCALES.includes(code)) return code;
  }
  return "uz";
}

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const locale = await browserLocale();

  // `gl-native` — kirish sahifasi Android ilovasining BIRINCHI ekrani: seans
  // tugaganda /student shu yerga yo'naltiradi. Shu sabab unda ham ilova hissi
  // qoidalari amal qilsin (teginish chaqnashi, uzoq bosish menyusi va h.k.).
  return (
    <div className="gl-native relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10">
      {/* Fon bezaklari */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="mx-auto mb-3 h-auto w-64 max-w-full object-contain" />
          <p className="mt-1 text-sm text-slate-500">{tr(locale, { uz: "O'quv markazini boshqarish tizimi", ru: "Система управления учебным центром", en: "Learning centre management system", de: "Verwaltungssystem für das Bildungszentrum" })}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft">
          <LoginForm locale={locale} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">© 2026 Germaniya Live</p>
      </div>
    </div>
  );
}
