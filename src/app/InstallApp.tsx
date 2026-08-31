"use client";

import { useEffect, useState } from "react";

// Ilovani o'rnatish tugmasi.
//
// Uch xil holat bor va qurilmaga qarab kerakligi ko'rsatiladi:
//   Android  — APK fayl (bo'lsa) yoki brauzerning "o'rnatish" taklifi
//   iPhone   — Safari'da "Bosh ekranga qo'shish" (boshqa yo'li yo'q)
//   Kompyuter— telefon bilan ochish uchun eslatma

type Platform = "android" | "ios" | "desktop";

interface BipEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallApp({
  apkHref, apkReady, apkSize, apkDate,
}: {
  apkHref: string;
  apkReady: boolean;
  apkSize: number | null;
  apkDate: string | null;
}) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<BipEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(
      /android/i.test(ua) ? "android"
      : /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) ? "ios"
      : "desktop",
    );
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BipEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  if (installed) {
    return (
      <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-center text-[14.5px] font-semibold text-emerald-800">
        Ilova allaqachon o&apos;rnatilgan — bosh ekrandan oching.
      </div>
    );
  }

  const btn = "flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-[15.5px] font-bold transition active:scale-[0.99]";

  return (
    <div className="space-y-2.5">
      {/* Android — APK */}
      {platform !== "ios" && apkReady ? (
        <a href={apkHref} className={btn + " bg-white text-[#0b3c4d] shadow-[0_10px_26px_-10px_rgba(0,0,0,0.5)]"}>
          <IcoAndroid />
          <span>
            Androidga yuklab olish
            {apkSize ? <span className="ml-1.5 font-medium text-slate-400">{apkSize} MB</span> : null}
          </span>
        </a>
      ) : null}

      {/* Brauzer orqali o'rnatish */}
      {prompt ? (
        <button type="button" onClick={install} className={btn + " bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm"}>
          <IcoDownload />
          Ilovani o&apos;rnatish
        </button>
      ) : null}

      {/* iPhone — qo'lda qo'shiladi */}
      {platform === "ios" ? (
        <>
          <button type="button" onClick={() => setIosHelp((v) => !v)} className={btn + " bg-white text-[#0b3c4d] shadow-[0_10px_26px_-10px_rgba(0,0,0,0.5)]"}>
            <IcoApple />
            iPhone&apos;ga o&apos;rnatish
          </button>
          {iosHelp ? (
            <ol className="space-y-1.5 rounded-2xl bg-white/12 p-4 text-[13.5px] leading-relaxed text-white/90 ring-1 ring-white/15">
              <li>1. Sahifani <b>Safari</b> brauzerida oching</li>
              <li>2. Pastdagi <b>Ulashish</b> belgisini bosing</li>
              <li>3. <b>&quot;Bosh ekranga qo&apos;shish&quot;</b> ni tanlang</li>
            </ol>
          ) : null}
        </>
      ) : null}

      {/* Hech qaysi yo'l chiqmasa — kirish havolasi baribir ishlaydi */}
      {platform === "desktop" && !apkReady && !prompt ? (
        <div className="rounded-2xl bg-white/12 px-5 py-4 text-center text-[13.5px] leading-relaxed text-white/85 ring-1 ring-white/15">
          Ilovani telefonda o&apos;rnatasiz — shu sahifani telefoningizda oching.
        </div>
      ) : null}

      {apkReady && apkDate ? (
        <div className="text-center text-[12px] text-white/55">Yangilangan: {apkDate}</div>
      ) : null}
    </div>
  );
}

function IcoAndroid({ s = 21 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 9.5h12v7.6a1.4 1.4 0 0 1-1.4 1.4H7.4A1.4 1.4 0 0 1 6 17.1V9.5Zm-2.6 0A1.4 1.4 0 0 1 4.8 11v4.2a1.4 1.4 0 0 1-2.8 0V11a1.4 1.4 0 0 1 1.4-1.5Zm17.2 0A1.4 1.4 0 0 1 22 11v4.2a1.4 1.4 0 0 1-2.8 0V11a1.4 1.4 0 0 1 1.4-1.5ZM9 19.2h1.6v2.2a1.1 1.1 0 0 1-2.2 0v-2.2Zm4.4 0H15v2.2a1.1 1.1 0 0 1-2.2 0v-2.2ZM8.3 3.1l1 1.8a6.4 6.4 0 0 1 5.4 0l1-1.8a.35.35 0 0 1 .6.35l-1 1.75A5.7 5.7 0 0 1 18 8.4H6a5.7 5.7 0 0 1 2.7-3.2L7.7 3.45a.35.35 0 0 1 .6-.35ZM9.4 6.5a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2Zm5.2 0a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2Z" />
    </svg>
  );
}
function IcoApple({ s = 21 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.2 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.15-2.8.85-3.5.85-.7 0-1.85-.83-3.05-.8-1.55.02-3 .9-3.8 2.3-1.63 2.82-.42 7 1.17 9.3.78 1.12 1.7 2.38 2.92 2.33 1.17-.05 1.62-.76 3.04-.76 1.42 0 1.82.76 3.06.73 1.27-.02 2.07-1.14 2.84-2.27.9-1.3 1.27-2.56 1.29-2.62-.03-.01-2.47-.95-2.5-3.76ZM13.9 5.4c.64-.78 1.07-1.86.95-2.94-.92.04-2.03.61-2.7 1.38-.6.69-1.11 1.79-.97 2.85 1.02.08 2.07-.52 2.72-1.29Z" />
    </svg>
  );
}
function IcoDownload({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" />
      <path d="M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </svg>
  );
}
