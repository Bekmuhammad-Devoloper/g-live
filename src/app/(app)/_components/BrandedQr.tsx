"use client";

import { useEffect, useRef } from "react";

/**
 * Brend uslubidagi QR kod — Germaniya Live logotipiga o'xshatilgan:
 *   - modullar logotipdagi qizil → sariq gradientda, yumaloq burchakli;
 *   - uchta burchak belgisi (finder) gradientda, lekin shakli STANDART kvadrat —
 *     skanerlar ularni 1:1:3:1:1 nisbat bilan topadi, yumaloqlansa o'qilmaydi
 *     (OpenCV bilan tekshirildi);
 *   - markazda "G + burgut" emblemasi (oq yumaloq karta ustida).
 * Server `errorCorrectionLevel: "H"` (30% zaxira) bilan yasaydi — emblema
 * ~5% joy oladi, shuning uchun skanerlar bemalol o'qiydi.
 * Canvas'da chiziladi; tayyor PNG `onPng` orqali qaytadi (yuklab olish uchun).
 */
export default function BrandedQr({
  modules, size, px = 640, logoSrc = "/logo-mark.png", className, onPng,
}: {
  /** Modullar satrma-satr: "0"/"1" belgilar, uzunligi size*size */
  modules: string;
  size: number;
  /** Chizish o'lchami (piksel) — PNG sifati shu */
  px?: number;
  logoSrc?: string;
  className?: string;
  onPng?: (dataUrl: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const QUIET = 2; // atrofdagi bo'sh modullar (skaner uchun kerak)
    const grid = size + QUIET * 2;
    const m = px / grid; // bitta modul (px)
    canvas.width = px;
    canvas.height = px;

    // Fon — oq, yumaloq burchak
    ctx.clearRect(0, 0, px, px);
    ctx.fillStyle = "#ffffff";
    rr(ctx, 0, 0, px, px, m * 1.5);
    ctx.fill();

    // Logotip gradienti (chapdan o'ngga diagonal): qizil → to'q sariq → sariq
    const grad = ctx.createLinearGradient(0, 0, px, px);
    grad.addColorStop(0, "#e11d2b");
    grad.addColorStop(0.55, "#f26a21");
    grad.addColorStop(1, "#f7a51c");
    ctx.fillStyle = grad;

    const isDark = (r: number, c: number) => modules[r * size + c] === "1";
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

    // Markazdagi emblema uchun joy — modullarning ~22% kengligi
    const logoMods = Math.round(size * 0.22);
    const logoStart = Math.floor((size - logoMods) / 2);
    const inLogo = (r: number, c: number) =>
      r >= logoStart && r < logoStart + logoMods && c >= logoStart && c < logoStart + logoMods;

    // Oddiy modullar — yumaloq burchakli, ozgina bo'shliq bilan
    const gap = m * 0.12;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isDark(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
        const x = (c + QUIET) * m + gap / 2;
        const y = (r + QUIET) * m + gap / 2;
        rr(ctx, x, y, m - gap, m - gap, (m - gap) * 0.35);
        ctx.fill();
      }
    }

    // Burchak belgilari: tashqi halqa (7×7) + ichki to'ldirilgan kvadrat (3×3) — to'g'ri burchakli
    const finder = (r0: number, c0: number) => {
      const x = (c0 + QUIET) * m;
      const y = (r0 + QUIET) * m;
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, 7 * m, 7 * m);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + m, y + m, 5 * m, 5 * m);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 2 * m, y + 2 * m, 3 * m, 3 * m);
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    // Markaz — oq yumaloq karta + emblema
    const lx = (logoStart + QUIET) * m;
    const ls = logoMods * m;
    ctx.fillStyle = "#ffffff";
    rr(ctx, lx - m * 0.5, lx - m * 0.5, ls + m, ls + m, m * 1.2);
    ctx.fill();

    const img = new Image();
    img.onload = () => {
      const pad = ls * 0.1;
      ctx.drawImage(img, lx + pad, lx + pad, ls - pad * 2, ls - pad * 2);
      onPng?.(canvas.toDataURL("image/png"));
    };
    img.onerror = () => onPng?.(canvas.toDataURL("image/png")); // emblema yuklanmasa ham QR ishlaydi
    img.src = logoSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, size, px, logoSrc]);

  return <canvas ref={ref} className={className} aria-label="QR" />;
}

/** Yumaloq burchakli to'rtburchak yo'li */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
