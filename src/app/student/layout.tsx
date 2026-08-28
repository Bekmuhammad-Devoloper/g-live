import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import BottomNav from "./BottomNav";

// O'quvchining mobil ilova ko'rinishidagi portali (2026-08-28 talab).
// AppShell (sidebar) ishlatilmaydi — telefon ilovasi kabi bitta ustun + pastki menyu.
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== ROLES.STUDENT) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#e4edf3]">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-5">{children}</div>
      <BottomNav />
    </div>
  );
}
