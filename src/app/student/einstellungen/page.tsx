import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { logout } from "../../(app)/actions";
import { CARD, PageHeader, SectionTitle, IcoLogout, IcoBell } from "../_ui";
import { S } from "../_i18n";
import MissingStudent from "../MissingStudent";
import PasswordForm from "../profil/PasswordForm";
import LocalePicker from "./LocalePicker";
import IdCard from "../IdCard";
import SecretField from "./SecretField";

// Sozlamalar — Profil sarlavhasidagi tishli g'ildirak ostidagi sahifa:
// hisob ma'lumotlari, ilova tili, xabarlar va xavfsizlik.

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
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      phone2: true,
      imageUrl: true,
      birthDate: true,
      age: true,
      currentLevel: true,
      // Parol maydonlari RSC yukiga tushmasligi uchun aniq select bilan
      user: { select: { email: true, locale: true, plainPassword: true } },
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { group: { select: { name: true, levelCode: true } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const unread = await prisma.notification.count({ where: { userId: session.userId, isRead: false } });
  const notifOn = await isPortalFeatureOn("mitteilungen");
  const group = student.enrollments[0]?.group ?? null;

  return (
    <div className="space-y-4">
      <PageHeader title={t.settings} subtitle={t.accountControl} backLabel={t.back} back="/student/profil" />

      {/* ── Guvohnoma ── */}
      <SectionTitle>{t.idCard}</SectionTitle>
      <IdCard
        t={t}
        p={{
          fullName: student.fullName,
          birthDate: student.birthDate ? student.birthDate.toISOString().slice(0, 10) : null,
          age: student.age,
          phone: student.phone,
          phone2: student.phone2,
          imageUrl: student.imageUrl,
          level: group?.levelCode ?? student.currentLevel ?? "—",
          group: group?.name ?? null,
          login: student.user?.email ?? "—",
          studentNo: student.id.slice(-6).toUpperCase(),
        }}
      />
      <p className="-mt-1 px-1 text-[11.5px] text-slate-500">{t.academicNote}</p>

      {/* ── Parol ── */}
      {student.user?.plainPassword ? (
        <div className={CARD + " flex items-center justify-between gap-3 px-4 py-3"}>
          <span className="text-[12.5px] font-semibold text-slate-500">{t.password}</span>
          <SecretField value={student.user.plainPassword} show={t.show} hide={t.hide} />
        </div>
      ) : null}

      {/* ── Til ── */}
      <SectionTitle>{t.appLanguage}</SectionTitle>
      <div className={CARD + " p-4"}>
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50">
            <IcoGlobe />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-slate-800">{t.interfaceLanguage}</div>
            <div className="text-[12px] text-slate-500">{t.savedInstantly}</div>
          </div>
        </div>
        <LocalePicker current={student.user?.locale ?? "uz"} />
      </div>

      {/* ── Bildirishnomalar ──
          Bo'lim o'chirilgan bo'lsa butun blok ko'rinmaydi (havola sahifaga
          olib bormas edi — /student ga qaytarardi). */}
      {notifOn && (
      <>
      <SectionTitle>{t.notifications}</SectionTitle>
      <a href="/student/mitteilungen" className={CARD + " flex items-center gap-3 p-4"}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50">
          <IcoBell s={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-800">{t.messages}</div>
          <div className="text-[12px] text-slate-500">{unread > 0 ? unread + " " + t.unreadCount : t.allRead}</div>
        </div>
        {unread > 0 ? (
          <span className="rounded-full bg-[#2ea8c9] px-2 py-[3px] text-[11px] font-bold text-white">{unread}</span>
        ) : null}
      </a>
      </>
      )}

      {/* ── Xavfsizlik ── */}
      <SectionTitle>{t.security}</SectionTitle>
      <div className={CARD + " px-5 py-1"}>
        <PasswordForm label={t.changePassword} />
        <div className="border-t border-slate-100">
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-3 py-3.5 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-50">
                <IcoLogout s={20} />
              </span>
              <span className="flex-1 text-[14px] font-semibold text-rose-600">{t.logout}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
