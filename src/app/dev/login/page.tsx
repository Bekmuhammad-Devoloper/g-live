import { redirect } from "next/navigation";
import { getDevSession } from "@/lib/devpanel/auth";
import LoginForm from "./LoginForm";

export default async function DevLoginPage() {
  if (await getDevSession()) redirect("/dev");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-white dark:bg-white dark:text-slate-900">GL</div>
          <h1 className="text-xl font-bold">Dev panel</h1>
          <p className="mt-1 text-sm text-slate-500">O'quv markazlari boshqaruvi</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
