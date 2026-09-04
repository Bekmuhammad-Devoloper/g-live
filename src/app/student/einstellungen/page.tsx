import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { logout } from "../../(app)/actions";
import { CARD, PageHeader, SectionTitle, IcoLogout, IcoBell, IcoDownload, IcoTeacher, TEAL } from "../_ui";
import { S } from "../_i18n";
import MissingStudent from "../MissingStudent";
import PasswordForm from "../profil/PasswordForm";
import LocalePicker from "./LocalePicker";
import IdCard from "../IdCard";
import SecretField from "./SecretField";

// Sozlamalar — Profil sarlavhasidagi tishli g'ildirak ostidagi sahifa.
//
// Sahifadagi barcha qatorlar BITTA ko'rinishda: chapda rangli ikonka
// plitasi, o'rtada nom va izoh, o'ngda qiymat yoki o'q. Ilgari uch xil
// uslub aralash edi — ba'zi bo'lim alohida karta, ba'zisi ro'yxat qatori,
// ba'zisi esa faqat matn — va sahifa yig'ilmagandek ko'rinardi.

function IcoChevron({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function IcoGlobe({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.5h17.6M3.2 14.5h17.6" />
      <path d="M12 3.2c2.3 2.4 3.4 5.4 3.4 8.8S14.3 18.4 12 20.8c-2.3-2.4-3.4-5.4-3.4-8.8S9.7 5.6 12 3.2Z" />
    </svg>
  );
}

/** Qator ichidagi rangli ikonka plitasi — barcha bo'limda bir xil */
function Tile({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "rose" }) {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px]"
      style={
        tone === "rose"
          ? { background: "rgba(244,63,94,0.12)", color: "#b91c1c" }
          : { background: "rgba(14,116,144,0.12)", color: TEAL }
      }
    >
      {children}
    </span>
  );
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** O'ngdagi qiymat — bo'lmasa faqat o'q chiziladi */
  value?: React.ReactNode;
  href?: string;
  tone?: "teal" | "rose";
}

/** Bitta qator. Havolasi bo'lsa bosiladi va o'q chiqadi. */
function Row({ icon, title, subtitle, value, href, tone }: RowProps) {
  const inner = (
    <>
      <Tile tone={tone}>{icon}</Tile>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold text-slate-800">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[12px] text-slate-600">{subtitle}</span>}
      </span>
      {value}
      {href && <IcoChevron s={16} />}
    </>
  );

  const cls = "flex min-h-[62px] w-full items-center gap-3 py-3 text-left";
  return href ? (
    <Link href={href} className={cls + " transition active:opacity-70"}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
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

  const [unread, notifOn, lehrerOn] = await Promise.all([
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    isPortalFeatureOn("mitteilungen"),
    isPortalFeatureOn("lehrer"),
  ]);
  const group = student.enrollments[0]?.group ?? null;

  return (
    <div className="space-y-4">
      <PageHeader title={t.settings} subtitle={t.accountControl} backLabel={t.back} back="/student/profil" />

      {/* ── Hisob ── */}
      <SectionTitle>{t.accountSection}</SectionTitle>
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
      <p className="-mt-1 px-1 text-[11.5px] text-slate-600">{t.academicNote}</p>

      {student.user?.plainPassword ? (
        <div className={CARD + " flex items-center justify-between gap-3 px-4 py-3"}>
          <span className="text-[12.5px] font-semibold text-slate-600">{t.password}</span>
          <SecretField value={student.user.plainPassword} show={t.show} hide={t.hide} />
        </div>
      ) : null}

      {/* ── Ilova ── */}
      <SectionTitle>{t.appSection}</SectionTitle>
      <div className={CARD + " divide-y divide-white/50 px-4"}>
        {/* Til tanlash qatori — tanlagich qator ostida ochiladi */}
        <div className="py-3">
          <div className="flex items-center gap-3">
            <Tile>
              <IcoGlobe />
            </Tile>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold text-slate-800">{t.interfaceLanguage}</div>
              <div className="mt-0.5 text-[12px] text-slate-600">{t.savedInstantly}</div>
            </div>
          </div>
          <div className="mt-3">
            <LocalePicker current={student.user?.locale ?? "uz"} />
          </div>
        </div>

        {notifOn && (
          <Row
            icon={<IcoBell c="currentColor" s={20} />}
            title={t.messages}
            subtitle={unread > 0 ? `${unread} ${t.unreadCount}` : t.allRead}
            href="/student/mitteilungen"
            value={
              unread > 0 ? (
                <span className="rounded-full bg-[#2ea8c9] px-2 py-[3px] text-[11px] font-bold text-white">{unread}</span>
              ) : undefined
            }
          />
        )}

        {lehrerOn && (
          <Row
            icon={<IcoTeacher c="currentColor" s={20} />}
            title={t.askTeacher}
            subtitle={t.askTeacherSub}
            href="/student/lehrer"
          />
        )}

        {/* Ilovani telefonga o'rnatish — /app sahifasi qurilmani o'zi aniqlaydi */}
        <Row
          icon={<IcoDownload c="currentColor" s={20} />}
          title={t.installApp}
          subtitle={t.installAppSub}
          href="/app"
        />
      </div>

      {/* ── Xavfsizlik ── */}
      <SectionTitle>{t.security}</SectionTitle>
      <div className={CARD + " divide-y divide-white/50 px-4"}>
        <div className="py-1">
          <PasswordForm label={t.changePassword} />
        </div>
        <form action={logout}>
          <button type="submit" className="flex min-h-[62px] w-full items-center gap-3 py-3 text-left transition active:opacity-70">
            <Tile tone="rose">
              <IcoLogout c="currentColor" s={20} />
            </Tile>
            <span className="flex-1 text-[14.5px] font-bold text-rose-600">{t.logout}</span>
          </button>
        </form>
      </div>

      {/* Versiya — qo'llab-quvvatlashga murojaat qilganda so'raladi */}
      <p className="pb-2 text-center text-[11.5px] text-slate-500">
        {t.appVersion} 1.1.0
      </p>
    </div>
  );
}
