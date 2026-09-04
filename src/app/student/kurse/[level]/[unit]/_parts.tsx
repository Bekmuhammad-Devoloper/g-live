import Link from "next/link";
import type { StudentStrings } from "../../../_i18n";

// Dars bo'limlari (Lug'at · Dars · Vazifa) uchun UMUMIY qismlar.
//
// Bu yordamchilar ilgari dars sahifasining ichida turardi. Sahifa uchta
// alohida marshrutga bo'lingach, ular bir joyda bo'lishi kerak — aks holda
// har bo'limda o'z nusxasi paydo bo'lib, vaqt o'tib bir-biridan uzilardi.

export const safeUrl = (u: string | null | undefined) => (u && /^(\/uploads\/|https?:\/\/)/.test(u) ? u : null);
export const isUpload = (u: string) => u.startsWith("/uploads/");
export const ext = (u: string) => (u.split("?")[0].split(".").pop() ?? "").toLowerCase();
export const isImage = (u: string) => ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext(u));
export const fileKind = (u: string) => {
  const e = ext(u).toUpperCase();
  return e && e.length <= 4 ? e : "FAYL";
};

/** YouTube yoki Vimeo havolasini o'rnatiladigan ko'rinishga o'giradi */
export function embedUrl(u: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(u);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** YouTube videoning muqova rasmi — pleyer bosilgunча shu ko'rinadi */
export function youtubePoster(u: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(u);
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : null;
}

/* ── Ikonkalar ── */
export function IcoBack({ s = 21 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  );
}
export function IcoBook({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.5C10.5 5 8.4 4.4 4.5 4.5v13c3.9-.1 6 .5 7.5 2 1.5-1.5 3.6-2.1 7.5-2v-13c-3.9-.1-6 .5-7.5 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}
// Vazifa — planshet va bajarilganlik belgisi. Ilgari ichida chiziqlar
// turardi: u "hujjat" edi, "bajariladigan ish" emas.
export function IcoClipboard({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8.6" y="2.6" width="6.8" height="3.4" rx="1.2" />
      <path d="M15.4 4.4h2.1A1.5 1.5 0 0 1 19 5.9v13.6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V5.9a1.5 1.5 0 0 1 1.5-1.5h2.1" />
      <path d="m8.4 12.4 2.1 2.1 4.6-4.9" strokeWidth="2.2" />
    </svg>
  );
}
export function IcoHome({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.4 10.6 8.6-7.1 8.6 7.1" />
      <path d="M5.6 9.6V20h12.8V9.6" />
      <path d="M9.8 20v-5.6h4.4V20" />
    </svg>
  );
}
export function IcoFile({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
      <path d="M13.5 3.5v5h5" />
    </svg>
  );
}
export function IcoChevron({ s = 18, color = "#94a3b8" }: { s?: number; color?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
export function IcoCheck({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}
export function IcoExpand({ s = 14 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-7.5 7.5M10 20H4v-6M4 20l7.5-7.5" />
    </svg>
  );
}

// Dars — ekran va o'ynatish belgisi. Oddiy doira ichidagi uchburchak
// har qanday tugmani bildirardi; ekran esa aynan VIDEO darsni.
export function IcoPlayCircle({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.6" y="4.4" width="18.8" height="13" rx="2.8" />
      <path d="M8.4 21h7.2M12 17.4V21" />
      <path d="M10.4 8.2v5.6l4.6-2.8-4.6-2.8Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
// Lug'at — ochiq kitob va xatcho'p. Ilgari ikki ustunli belgi turardi: u
// "ustunlar" bo'lib o'qilib, lug'atga ishora qilmasdi.
export function IcoWords({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.6C10.4 5.1 8.2 4.5 4.4 4.6v12.9c3.8-.1 6 .5 7.6 2 1.6-1.5 3.8-2.1 7.6-2V4.6c-3.8-.1-6 .5-7.6 2Z" />
      <path d="M12 6.6v12.9" />
      <path d="M15.6 4.8v5.4l2-1.4 2 1.4V4.8" fill="currentColor" stroke="none" opacity="0.9" />
    </svg>
  );
}

/* ── Kartaning burchagidagi yumshoq rang dog'i ── */
export function Wash({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full blur-2xl"
      style={{ background: color }}
    />
  );
}

/* ── Biriktirilgan fayl ── */
export function Attachment({ url, tint, accent, t }: { url: string; tint: string; accent: string; t: StudentStrings }) {
  // Rasm bo'lsa — bitta blok: ustida rasmning o'zi, ostida ingichka qator.
  // Ilgari rasm ham, alohida "Faylni ochish" qatori ham chizilar edi va
  // bitta narsa ikki marta ko'rinardi.
  if (isImage(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block overflow-hidden rounded-[18px] ring-1 ring-slate-900/[0.06] transition active:scale-[0.99]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={t.attachment} className="max-h-[290px] w-full bg-white object-contain" />
        <span className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: tint }}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white" style={{ color: accent }}>
            <IcoExpand s={13} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-slate-700">{t.openFull}</span>
          <span className="shrink-0 text-[11px] font-semibold text-slate-400">{fileKind(url)}</span>
          <IcoChevron s={15} />
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition active:scale-[0.985]"
      style={{ background: tint }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-white shadow-[0_4px_10px_-4px_rgba(15,60,80,0.4)]" style={{ color: accent }}>
        <IcoFile />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold leading-tight text-slate-800">{t.openFile}</span>
        <span className="block text-[11.5px] font-medium leading-tight text-slate-400">{fileKind(url)}</span>
      </span>
      <IcoChevron />
    </a>
  );
}

/* ── Dars topshirig'i / uyga vazifa bloki ── */
export function TaskCard({
  title, icon, accent, tint, wash, body, fileUrl, t,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  tint: string;
  wash: string;
  body: string | null;
  fileUrl: string | null;
  t: StudentStrings;
}) {
  return (
    <section className="gl-glass relative overflow-hidden rounded-[26px] p-4">
      <Wash color={wash} />
      <div className="relative flex gap-3.5">
        <span
          className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[19px] text-white shadow-[0_10px_20px_-8px_rgba(15,60,80,0.65)]"
          style={{ background: accent }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-[17px] font-extrabold leading-tight tracking-[-0.015em] text-slate-900">{title}</h2>
          {body ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-[1.6] text-slate-500">{body}</p>
          ) : null}
        </div>
      </div>

      {fileUrl ? (
        <div className="relative">
          <Attachment url={fileUrl} tint={tint} accent={accent} t={t} />
        </div>
      ) : null}
    </section>
  );
}


/* ── Bo'lim sahifalarining umumiy sarlavhasi ── */
// Uchala bo'lim (Lug'at · Dars · Vazifa) bir xil sarlavha bilan ochiladi:
// orqaga tugma, bo'lim nomi va ostida qaysi darsdan ekani.
export function SectionHeader({
  backHref, title, subtitle, accent, backLabel,
}: {
  backHref: string;
  title: string;
  subtitle: string;
  /** Bo'limning rangi — ikonka plitasi bilan bir xil */
  accent: string;
  backLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-[0_10px_22px_-10px_rgba(15,60,80,0.9)] transition active:scale-95"
        style={{ background: accent }}
      >
        <IcoBack s={22} />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">{title}</h1>
        <div className="truncate text-[12.5px] font-medium text-slate-600">{subtitle}</div>
      </div>
    </div>
  );
}
