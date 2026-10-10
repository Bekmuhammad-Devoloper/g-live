import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LOCALES, ROLES, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getActiveLevels } from "@/lib/studyLevels";
import { isNativeAppUa, lessonLinkPath } from "@/lib/lessonLink";
import { qrStudentOf } from "@/lib/lessonQrAccess";
import { getBrand } from "@/lib/brand";
import BrandLogo from "@/app/BrandLogo";

// Dars QR kodi ochadigan manzil. Sahifaning o'zi mazmun ko'rsatmaydi — kim
// kelganiga qarab yo'naltiradi:
//
//   seans yo'q, brauzer   → "Ilovada ochish / yuklab olish / kirish" ekrani
//   seans yo'q, ilova     → /login?next=/l/<id> (kirgach shu yerga qaytadi)
//   faol o'quvchi         → dars videosi (o'z kursidagi dars — ilovadagi o'z
//                           o'rnida, boshqa kursniki — alohida video sahifada)
//   guruhsiz o'quvchi     → tushuntirish xabari
//   xodim                 → kurs sahifasi (CRM)
//
// Ilova o'rnatilgan telefonda havola brauzerga kelmaydi: Android uni to'g'ridan
// ilovada ochadi (manifestdagi App Links filtri), NativeShell esa shu manzilga o'tadi.

export async function generateMetadata() {
  const brand = await getBrand();
  return { title: brand.name, robots: { index: false, follow: false } };
}

const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || "live.germaniya.app";

function localeOf(accept: string): Locale {
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase() as Locale;
    if (LOCALES.includes(code)) return code;
  }
  return "uz";
}

export default async function LessonLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await prisma.courseLesson.findUnique({
    where: { id },
    select: { id: true, title: true, levelCode: true, programId: true, program: { select: { name: true } } },
  });
  if (!lesson) notFound();

  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const self = lessonLinkPath(lesson.id);
  const loginHref = `/login?next=${encodeURIComponent(self)}`;
  const session = await getSession();

  if (!session) {
    // Ilova ichida — to'g'ridan kirish oynasi; "yuklab oling" ekrani ortiqcha
    if (isNativeAppUa(ua)) redirect(loginHref);

    const locale = localeOf(h.get("accept-language") ?? "");
    const host = h.get("host") ?? "germaniya.live";
    const isAndroid = /Android/i.test(ua);
    // Chrome (Android): ilova bor bo'lsa shu manzil bilan ochiladi, yo'q bo'lsa
    // yuklab olish sahifasiga o'tadi
    const openInApp = isAndroid
      ? `intent://${host}${self}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(`https://${host}/app`)};end`
      : null;
    const brand = await getBrand();
    // Mobil ilova faqat asosiy markazniki — boshqa markazlarda ilova tugmalari ko'rsatilmaydi
    return (
      <Gateway
        locale={locale}
        title={lesson.title}
        course={lesson.program.name}
        openInApp={brand.isMain ? openInApp : null}
        loginHref={loginHref}
        brandName={brand.name}
        hasApp={brand.isMain}
      />
    );
  }

  const locale = session.locale;

  if (session.role === ROLES.STUDENT) {
    const st = await qrStudentOf(session.userId);
    if (!st || st.groups.length === 0) {
      return (
        <Notice
          locale={locale}
          title={tr(locale, { uz: "Dars faqat faol o'quvchilar uchun", ru: "Урок доступен только активным ученикам", en: "This lesson is for active students only", de: "Diese Lektion ist nur für aktive Schüler" })}
          body={tr(locale, { uz: "Siz hozircha hech bir guruhga biriktirilmagansiz. Guruhga qo'shilganingizdan so'ng QR kodni qayta skanerlang yoki administratorga murojaat qiling.", ru: "Вы пока не прикреплены ни к одной группе. После зачисления в группу отсканируйте QR-код снова или обратитесь к администратору.", en: "You are not enrolled in any group yet. Once you join a group, scan the QR code again or contact the administrator.", de: "Du bist noch keiner Gruppe zugeordnet. Scanne den QR-Code nach der Aufnahme in eine Gruppe erneut oder wende dich an die Verwaltung." })}
          href="/student"
          cta={tr(locale, { uz: "Bosh sahifa", ru: "Главная", en: "Home", de: "Startseite" })}
        />
      );
    }

    // O'z kursidagi dars — ilovadagi o'z joyida ochiladi (lug'at, mashq, vazifa bilan birga).
    // Ilova "asosiy" deb eng oxirgi guruhni oladi, shuning uchun aynan shu guruh tekshiriladi.
    const main = st.groups[0];
    if (main.programId === lesson.programId) {
      const fallback = (main.levelCode ?? st.currentLevel ?? "A1").slice(0, 2);
      const code = (lesson.levelCode ?? fallback).toUpperCase();
      const known = (await getActiveLevels()).some((l) => l.code.toUpperCase() === code);
      if (known) redirect(`/student/kurse/${code}/${lesson.id}/dars/video`);
    }
    redirect(`/student/dars/video/${lesson.id}`);
  }

  if (session.role === ROLES.PARENT) {
    return (
      <Notice
        locale={locale}
        title={tr(locale, { uz: "Dars o'quvchi hisobida ochiladi", ru: "Урок открывается в аккаунте ученика", en: "The lesson opens in a student account", de: "Die Lektion wird im Schülerkonto geöffnet" })}
        body={tr(locale, { uz: "Video darsni ko'rish uchun o'quvchining login va paroli bilan kiring.", ru: "Чтобы посмотреть видеоурок, войдите с логином и паролем ученика.", en: "Sign in with the student's login and password to watch the video lesson.", de: "Melde dich mit den Zugangsdaten des Schülers an, um die Videolektion anzusehen." })}
        href="/dashboard"
        cta={tr(locale, { uz: "Bosh sahifa", ru: "Главная", en: "Home", de: "Startseite" })}
      />
    );
  }

  // Xodim — darsni CRM'dagi kurs sahifasida ko'radi (ruxsatni sahifaning o'zi tekshiradi)
  redirect(`/courses/${lesson.programId}`);
}

/* ── Ko'rinish ── */

async function Shell({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <div className="gl-native relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandLogo
            brand={brand}
            variant="light"
            className="mx-auto h-auto w-56 max-w-full object-contain"
            textClassName="block text-2xl font-extrabold tracking-tight text-slate-900"
          />
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} {brand.name}</p>
      </div>
    </div>
  );
}

const BTN = "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.99]";

function Gateway({ locale, title, course, openInApp, loginHref, brandName, hasApp }: { locale: Locale; title: string; course: string; openInApp: string | null; loginHref: string; brandName: string; hasApp: boolean }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  return (
    <Shell>
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          {T("Video dars", "Видеоурок", "Video lesson", "Videolektion")}
        </span>
        <h1 className="mt-3 text-xl font-bold leading-snug text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{course}</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          {hasApp
            ? T(
                `Dars ${brandName} ilovasida ochiladi. Guruhimizdagi faol o'quvchilar uchun bepul.`,
                `Урок открывается в приложении ${brandName}. Для активных учеников наших групп — бесплатно.`,
                `The lesson opens in the ${brandName} app. Free for active students of our groups.`,
                `Die Lektion wird in der ${brandName}-App geöffnet. Für aktive Schüler unserer Gruppen kostenlos.`,
              )
            : T(
                `Dars ${brandName} tizimida ochiladi. Guruhimizdagi faol o'quvchilar uchun bepul.`,
                `Урок открывается в системе ${brandName}. Для активных учеников наших групп — бесплатно.`,
                `The lesson opens in the ${brandName} system. Free for active students of our groups.`,
                `Die Lektion wird im System von ${brandName} geöffnet. Für aktive Schüler unserer Gruppen kostenlos.`,
              )}
        </p>
      </div>

      <div className="mt-6 space-y-2.5">
        {openInApp && (
          <a href={openInApp} className={`${BTN} bg-brand-600 text-white shadow-sm hover:bg-brand-700`}>
            {T("Ilovada ochish", "Открыть в приложении", "Open in the app", "In der App öffnen")}
          </a>
        )}
        {hasApp && (
          <Link href="/app" className={`${BTN} ${openInApp ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-brand-600 text-white shadow-sm hover:bg-brand-700"}`}>
            {T("Ilovani yuklab olish", "Скачать приложение", "Download the app", "App herunterladen")}
          </Link>
        )}
        <Link href={loginHref} className={`${BTN} ${hasApp ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-brand-600 text-white shadow-sm hover:bg-brand-700"}`}>
          {T("Brauzerda kirish", "Войти в браузере", "Sign in in the browser", "Im Browser anmelden")}
        </Link>
      </div>

      <ol className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-[13px] leading-relaxed text-slate-500">
        {hasApp ? (
          <>
            <li>1. {T("Ilova yo'q bo'lsa — yuklab oling va o'rnating.", "Если приложения нет — скачайте и установите.", "No app yet? Download and install it.", "Noch keine App? Lade sie herunter und installiere sie.")}</li>
            <li>2. {T("Login va parolingiz bilan kiring.", "Войдите со своим логином и паролем.", "Sign in with your login and password.", "Melde dich mit deinen Zugangsdaten an.")}</li>
            <li>3. {T("QR kodni qayta skanerlang — dars videosi ochiladi.", "Отсканируйте QR-код ещё раз — откроется видеоурок.", "Scan the QR code again — the video lesson opens.", "Scanne den QR-Code erneut — die Videolektion öffnet sich.")}</li>
          </>
        ) : (
          <>
            <li>1. {T("Login va parolingiz bilan kiring.", "Войдите со своим логином и паролем.", "Sign in with your login and password.", "Melde dich mit deinen Zugangsdaten an.")}</li>
            <li>2. {T("Kirgandan so'ng dars videosi ochiladi.", "После входа откроется видеоурок.", "After signing in, the video lesson opens.", "Nach der Anmeldung öffnet sich die Videolektion.")}</li>
          </>
        )}
      </ol>
    </Shell>
  );
}

function Notice({ title, body, href, cta }: { locale: Locale; title: string; body: string; href: string; cta: string }) {
  return (
    <Shell>
      <div className="text-center">
        <h1 className="text-lg font-bold leading-snug text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
        <Link href={href} className={`${BTN} mt-6 bg-brand-600 text-white shadow-sm hover:bg-brand-700`}>{cta}</Link>
      </div>
    </Shell>
  );
}
