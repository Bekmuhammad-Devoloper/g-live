import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logout } from "../../(app)/actions";
import { CARD, PageHeader, SectionTitle, IcoLogout, IcoBell } from "../_ui";
import { S } from "../_i18n";
import MissingStudent from "../MissingStudent";
import PasswordForm from "../profil/PasswordForm";
import LocalePicker from "./LocalePicker";
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 py-2.5 last:border-0">
      <span className="shrink-0 text-[12.5px] font-semibold text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-right text-[14px] font-bold text-slate-800">{children}</span>
    </div>
  );
}

export default async function StudentSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      fullName: true,
      phone: true,
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
  const group = student.enrollments[0]?.group ?? null;

  return (
    <div className="space-y-4">
      <PageHeader title={t.settings} subtitle={t.accountControl} back="/student/profil" />

      {/* ── Hisob ma'lumotlari ── */}
      <SectionTitle>{t.accountData}</SectionTitle>
      <div className={CARD + " px-4 py-1"}>
        <Row label={t.fullName}>{student.fullName}</Row>
        {student.phone ? <Row label={t.phone}>{student.phone}</Row> : null}
        {group ? <Row label={t.group}>{group.name}</Row> : null}
        <Row label={t.level}>{group?.levelCode ?? student.currentLevel ?? "—"}</Row>
        <Row label={t.login}>{student.user?.email ?? "—"}</Row>
        {student.user?.plainPassword ? (
          <Row label={t.password}>
            <SecretField value={student.user.plainPassword} show={t.show} hide={t.hide} />
          </Row>
        ) : null}
      </div>
      <p className="-mt-1 px-1 text-[11.5px] text-slate-400">{t.contactCenter}</p>

      {/* ── Til ── */}
      <SectionTitle>{t.appLanguage}</SectionTitle>
      <div className={CARD + " p-4"}>
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50">
            <IcoGlobe />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-slate-800">{t.interfaceLanguage}</div>
            <div className="text-[12px] text-slate-400">{t.savedInstantly}</div>
          </div>
        </div>
        <LocalePicker current={student.user?.locale ?? "uz"} />
      </div>

      {/* ── Bildirishnomalar ── */}
      <SectionTitle>{t.notifications}</SectionTitle>
      <a href="/student/mitteilungen" className={CARD + " flex items-center gap-3 p-4"}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50">
          <IcoBell s={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-800">{t.messages}</div>
          <div className="text-[12px] text-slate-400">{unread > 0 ? unread + " " + t.unreadCount : t.allRead}</div>
        </div>
        {unread > 0 ? (
          <span className="rounded-full bg-[#2ea8c9] px-2 py-[3px] text-[11px] font-bold text-white">{unread}</span>
        ) : null}
      </a>

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
