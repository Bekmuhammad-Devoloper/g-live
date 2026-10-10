import type { StudentStrings } from "../../../../../_i18n";
import { embedUrl, isImage, isUpload, safeUrl, youtubePoster } from "../../_parts";
import Player from "./Player";
import BrandLogo, { type BrandView } from "@/app/BrandLogo";

// Dars videosining muqovasi + "Ko'rish" tugmasi.
//
// Muqova ATAYLAB o'zimizniki: YouTube iframe'i faqat "Ko'rish" bosilganda
// yuklanadi. Aks holda sahifa ochilishi bilan YouTube o'z brendi, tavsiyalari
// va bir necha yuz kilobayt skriptini olib kelardi.
//
// Ikki joyda ishlatiladi: darsning o'z video sahifasi va QR orqali ochiladigan
// alohida video sahifa (/student/dars/video/<id>).

export const VIDEO_ACCENT = "linear-gradient(150deg, #2fb9dc 0%, #0e7490 100%)";

export default function VideoCover({
  lesson, watched, t, brand,
}: {
  lesson: { id: string; videoUrl: string | null; videoPosterUrl: string | null };
  watched: boolean;
  t: StudentStrings;
  /** Markaz brendi — muqova bo'lmaganda logotip (yoki nom) ko'rsatiladi */
  brand: BrandView;
}) {
  const video = safeUrl(lesson.videoUrl);
  const embed = video && !isUpload(video) ? embedUrl(video) : null;
  const mode = !video ? "none" : isUpload(video) ? "file" : embed ? "embed" : "link";
  // Muqova: ustoz yuklagan video banneri → bo'lmasa YouTube muqovasi → bo'lmasa ilova logotipi
  const banner = safeUrl(lesson.videoPosterUrl);
  const poster = banner && isImage(banner) ? banner : video && !isUpload(video) ? youtubePoster(video) : null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[24px] shadow-[0_18px_36px_-20px_rgba(9,32,53,0.8)]" style={{ background: VIDEO_ACCENT }}>
      {poster ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-black/25" />
        </>
      ) : (
        <>
          {/* Banner yuklanmagan va video muqovasi yo'q — o'rniga ilova logotipi.
              Diagonal chiziqlar tekis rangni "jonlantiradi". */}
          <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.14]" preserveAspectRatio="none" viewBox="0 0 100 56">
            <g stroke="#fff" strokeWidth="6" fill="none">
              <path d="M-10 66 L40 -10" />
              <path d="M10 66 L60 -10" />
              <path d="M30 66 L80 -10" />
              <path d="M50 66 L100 -10" />
            </g>
          </svg>
          <span className="absolute inset-0 grid place-items-center px-8">
            <BrandLogo
              brand={brand}
              variant="dark"
              className="max-h-[46%] w-auto max-w-[74%] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
              textClassName="text-center text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
            />
          </span>
        </>
      )}

      {/* "Ko'rish" — bosilganda to'liq ekran gorizontal pleyer ochiladi */}
      <div className="absolute bottom-3.5 right-3.5">
        <Player
          mode={mode}
          src={mode === "embed" ? embed : video}
          poster={poster}
          lessonId={lesson.id}
          watched={watched}
          playLabel={t.watchVideo}
          closeLabel={t.closePlayer}
          rotateHint={t.rotateHint}
        />
      </div>

      {mode === "none" && (
        <span className="absolute inset-x-0 bottom-0 bg-black/45 px-4 py-2.5 text-center text-[12.5px] font-semibold text-white/85">
          {t.noVideoYet}
        </span>
      )}
    </div>
  );
}
