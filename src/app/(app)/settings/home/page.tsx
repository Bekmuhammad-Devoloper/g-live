import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getBanners, getVideos, videoThumb } from "@/lib/portalContent";
import { PageHeader, Forbidden } from "../../_components/ui";
import HomeContentView, { type VBanner, type VVideo } from "./HomeContentView";

// O'quvchi bosh sahifasidagi banner va videolar — direktor va menejer
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER, ROLES.ROP];

export default async function HomeContentPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, { uz: "Bu bo'lim direktor va menejer uchun.", ru: "Этот раздел для директора и менеджера.", en: "This section is for the director and managers.", de: "Dieser Bereich ist für Direktor und Manager." })}
      />
    );
  }

  const [banners, videos] = await Promise.all([getBanners(), getVideos()]);

  const bRows: VBanner[] = banners.map((b) => ({
    id: b.id, title: b.title, subtitle: b.subtitle, btnLabel: b.btnLabel,
    href: b.href, imageUrl: b.imageUrl, color: b.color, isActive: b.isActive,
  }));

  const vRows: VVideo[] = videos.map((v) => ({
    id: v.id, title: v.title, note: v.note, url: v.url,
    kind: v.kind, isActive: v.isActive, thumb: videoThumb(v.url),
  }));

  return (
    <div>
      <PageHeader
        title={tr(s.locale, { uz: "Bosh sahifa", ru: "Главная страница", en: "Home page", de: "Startseite" })}
        subtitle={tr(s.locale, {
          uz: "O'quvchi ilovasidagi bannerlar va videolar",
          ru: "Баннеры и видео в приложении ученика",
          en: "Banners and videos in the student app",
          de: "Banner und Videos in der Schüler-App",
        })}
      />
      <HomeContentView banners={bRows} videos={vRows} locale={s.locale} />
    </div>
  );
}
