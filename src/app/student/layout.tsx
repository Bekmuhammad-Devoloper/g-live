import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import BottomNav from "./BottomNav";

// O'quvchining mobil ilova ko'rinishidagi portali (2026-08-28 talab).
// AppShell (sidebar) ishlatilmaydi — telefon ilovasi kabi bitta ustun + pastki menyu.
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== ROLES.STUDENT) redirect("/dashboard");

  // "Kurse" yorlig'i — o'quvchining faol guruhi sahifasiga olib boradi
  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { enrollments: { where: { isActive: true }, take: 1, orderBy: { joinedAt: "desc" }, select: { groupId: true } } },
  });
  const kurseHref = student?.enrollments[0] ? `/groups/${student.enrollments[0].groupId}` : "/student";

  return (
    <div className="min-h-screen bg-[#e4edf3]">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-5">{children}</div>
      <BottomNav kurseHref={kurseHref} />
    </div>
  );
}
