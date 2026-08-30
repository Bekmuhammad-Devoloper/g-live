import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logout } from "../../(app)/actions";
import { CARD, PageHeader, SectionTitle, IcoLogout, IcoBell } from "../_ui";
import MissingStudent from "../MissingStudent";
import PasswordForm from "../profil/PasswordForm";
import LocalePicker from "./LocalePicker";

// Sozlamalar — Profil sarlavhasidagi tishli g'ildirak ostidagi sahifa.
// Bu yerda faqat o'quvchining o'z hisobiga tegishli narsalar: til, parol,
// bildirishnomalar holati va chiqish.

function IcoGlobe({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#0e7490" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.5h17.6M3.2 14.5h17.6" />
      <path d="M12 3.2c2.3 2.4 3.4 5.4 3.4 8.8S14.3 18.4 12 20.8c-2.3-2.4-3.4-5.4-3.4-8.8S9.7 5.6 12 3.2Z" />
    </svg>
  );
}

export default async function StudentSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      fullName: true,
      phone: true,
      // Parol maydonlari RSC yukiga tushmasligi uchun select bilan
      user: { select: { email: true, locale: true } },
    },
  });
  if (!student) return <MissingStudent />;

  const unread = await prisma.notification.count({ where: { userId: session.userId, isRead: false } });

  return (
    <div className="space-y-4">
      <PageHeader title="Sozlamalar" subtitle="Hisobingiz boshqaruvi" back="/student/profil" />

      {/* ── Til ── */}
      <SectionTitle>Ilova tili</SectionTitle>
      <div className={CARD + " p-4"}>
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50">
            <IcoGlobe />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-slate-800">Interfeys tili</div>
            <div className="text-[12px] text-slate-400">Tanlov darhol saqlanadi</div>
          </div>
        </div>
        <LocalePicker current={student.user?.locale ?? "uz"} />
      </div>

      {/* ── Bildirishnomalar ── */}
      <SectionTitle>Bildirishnomalar</SectionTitle>
      <a href="/student/mitteilungen" className={CARD + " flex items-center gap-3 p-4"}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50">
          <IcoBell s={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-800">Xabarlar</div>
          <div className="text-[12px] text-slate-400">
            {unread > 0 ? unread + " ta o'qilmagan xabar" : "Hammasi o'qilgan"}
          </div>
        </div>
        {unread > 0 ? (
          <span className="rounded-full bg-[#2ea8c9] px-2 py-[3px] text-[11px] font-bold text-white">{unread}</span>
        ) : null}
      </a>

      {/* ── Xavfsizlik ── */}
      <SectionTitle>Xavfsizlik</SectionTitle>
      <div className={CARD + " px-5 py-1"}>
        <PasswordForm />
        <div className="border-t border-slate-100">
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-3 py-3.5 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-50">
                <IcoLogout s={20} />
              </span>
              <span className="flex-1 text-[14px] font-semibold text-rose-600">Chiqish</span>
            </button>
          </form>
        </div>
      </div>

      <p className="pb-2 text-center text-[11.5px] text-slate-400">
        {student.user?.email}
        {student.phone ? " · " + student.phone : ""}
      </p>
    </div>
  );
}
