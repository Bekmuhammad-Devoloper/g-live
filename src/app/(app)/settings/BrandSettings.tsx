"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { saveBrand } from "./actions";

export interface BrandSettingsValue {
  name: string;
  logo: string;
  logoDark: string;
}

type LogoKey = "logo" | "logoDark";

// Markaz brendi — nomi va logotiplari (bazada Setting: brand.*). Bo'sh maydon standart
// qiymatni bildiradi; `defaults` — maydon bo'sh bo'lganda getBrand() qaytaradigan standart qiymatlar.
export default function BrandSettings({ locale, initial, defaults }: { locale: Locale; initial: BrandSettingsValue; defaults: BrandSettingsValue }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const router = useRouter();
  const [v, setV] = useState<BrandSettingsValue>(initial);
  const [uploading, setUploading] = useState<LogoKey | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const lightRef = useRef<HTMLInputElement>(null);
  const darkRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof BrandSettingsValue>(k: K, val: BrandSettingsValue[K]) => { setV((s) => ({ ...s, [k]: val })); setMsg(null); };

  const uploadFailed = T("Logotipni yuklab bo'lmadi", "Не удалось загрузить логотип", "Logo upload failed", "Logo-Upload fehlgeschlagen");

  const onFile = (key: LogoKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      setMsg({ ok: false, text: T("Faqat PNG, JPG, WEBP yoki GIF rasm", "Только изображения PNG, JPG, WEBP или GIF", "PNG, JPG, WEBP or GIF images only", "Nur PNG-, JPG-, WEBP- oder GIF-Bilder") });
      return;
    }
    setMsg(null); setUploading(key);
    const fd = new FormData(); fd.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.onload = () => {
      setUploading(null);
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status < 300 && j.url) set(key, j.url);
        else setMsg({ ok: false, text: uploadFailed });
      } catch { setMsg({ ok: false, text: uploadFailed }); }
    };
    xhr.onerror = () => { setUploading(null); setMsg({ ok: false, text: uploadFailed }); };
    xhr.send(fd);
  };

  const save = () => {
    setMsg(null);
    startSave(async () => {
      const r = await saveBrand(v);
      if (r.ok) {
        setMsg({ ok: true, text: T("Saqlandi", "Сохранено", "Saved", "Gespeichert") });
        router.refresh();
      } else {
        setMsg({
          ok: false,
          text: r.error === "forbidden"
            ? T("Saqlanmadi — ruxsat yo'q", "Не сохранено — нет доступа", "Not saved — no permission", "Nicht gespeichert — keine Berechtigung")
            : r.error === "name_too_long"
              ? T("Nom juda uzun (80 belgigacha)", "Название слишком длинное (до 80 символов)", "Name is too long (up to 80 characters)", "Name ist zu lang (bis zu 80 Zeichen)")
              : T("Logotip manzili noto'g'ri", "Неверный адрес логотипа", "Invalid logo address", "Ungültige Logo-Adresse"),
        });
      }
    });
  };

  // Ko'rinish: bo'sh maydon o'rniga amaldagi (standart) qiymat
  // (getBrand bilan bir xil tartib: qorong'i logotip bo'lmasa — standart, u ham bo'lmasa yorug' logotip)
  const name = v.name.trim() || defaults.name;
  const light = v.logo || defaults.logo;
  const dark = v.logoDark || defaults.logoDark || light;

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{T("Markaz brendi", "Бренд центра", "Centre brand", "Marke des Zentrums")}</h2>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        {T(
          "Markaz nomi va logotiplari tizimning barcha sahifalarida (menyu, kirish sahifasi, ariza va test sahifalari, chek) ko'rsatiladi.",
          "Название и логотипы центра отображаются на всех страницах системы (меню, вход, заявки и тесты, чек).",
          "The centre name and logos appear on every page of the system (menu, sign-in, application and test pages, receipt).",
          "Name und Logos des Zentrums erscheinen auf allen Seiten des Systems (Menü, Anmeldung, Antrags- und Testseiten, Beleg).",
        )}
      </p>

      <div className="max-w-xl">
        <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
          {T("O'quv markazi nomi", "Название учебного центра", "Learning centre name", "Name des Bildungszentrums")}
        </label>
        <input value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder={defaults.name} className={inp} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <LogoSlot
          title={T("Logotip (yorug' fon)", "Логотип (светлый фон)", "Logo (light background)", "Logo (heller Hintergrund)")}
          hint={T("Yorug' rejimda ko'rinadi", "Показывается в светлой теме", "Shown in light mode", "Wird im hellen Modus angezeigt")}
          src={light}
          dark={false}
          name={name}
          busy={uploading === "logo"}
          onPick={() => lightRef.current?.click()}
          onClear={v.logo ? () => set("logo", "") : undefined}
          T={T}
        />
        <LogoSlot
          title={T("Logotip (qorong'i fon)", "Логотип (тёмный фон)", "Logo (dark background)", "Logo (dunkler Hintergrund)")}
          hint={T("Qorong'i rejimda ko'rinadi; bo'sh bo'lsa yorug' logotip ishlatiladi", "Показывается в тёмной теме; если пусто — используется светлый логотип", "Shown in dark mode; if empty, the light logo is used", "Wird im dunklen Modus angezeigt; leer — das helle Logo wird verwendet")}
          src={dark}
          dark
          name={name}
          busy={uploading === "logoDark"}
          onPick={() => darkRef.current?.click()}
          onClear={v.logoDark ? () => set("logoDark", "") : undefined}
          T={T}
        />
      </div>
      <input ref={lightRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onFile("logo")} />
      <input ref={darkRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onFile("logoDark")} />

      <p className="mt-3 text-xs text-slate-400">
        {T(
          "Tavsiya: shaffof fonli PNG, eni 400–800 px. Logotip bo'lmasa markaz nomi matn ko'rinishida chiqadi.",
          "Рекомендуется: PNG с прозрачным фоном, ширина 400–800 px. Без логотипа выводится название центра.",
          "Recommended: transparent PNG, 400–800 px wide. Without a logo the centre name is shown as text.",
          "Empfohlen: PNG mit transparentem Hintergrund, 400–800 px breit. Ohne Logo wird der Name als Text angezeigt.",
        )}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving || uploading !== null}
          className="rounded-lg bg-amber-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60">
          {saving ? T("Saqlanmoqda…", "Сохранение…", "Saving…", "Wird gespeichert…") : T("Saqlash", "Сохранить", "Save", "Speichern")}
        </button>
        {msg && (
          <span className={cn("flex items-center gap-1 text-sm font-medium", msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {msg.ok && <Icon name="check" className="h-4 w-4" />} {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:ring-brand-900";

function LogoSlot({ title, hint, src, dark, name, busy, onPick, onClear, T }: {
  title: string;
  hint: string;
  src: string;
  dark: boolean;
  name: string;
  busy: boolean;
  onPick: () => void;
  onClear?: () => void;
  T: (uz: string, ru: string, en: string, de: string) => string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">{title}</div>
      {/* Ko'rinish — fon rejimga mos (yorug'/qorong'i), ilovadagi joylashuvga yaqin */}
      <button type="button" onClick={onPick} disabled={busy}
        className={cn("grid h-32 w-full place-items-center overflow-hidden rounded-xl border border-dashed px-4 transition hover:border-brand-400",
          dark ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-white")}>
        {busy ? (
          <span className={cn("text-xs", dark ? "text-slate-400" : "text-slate-500")}>{T("Yuklanmoqda…", "Загрузка…", "Uploading…", "Wird hochgeladen…")}</span>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="max-h-20 w-auto max-w-full object-contain" />
        ) : (
          <span className={cn("text-center text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-slate-900")}>{name}</span>
        )}
      </button>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <button type="button" onClick={onPick} disabled={busy} className="flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-300">
          <Icon name="camera" className="h-3.5 w-3.5" /> {T("Yuklash", "Загрузить", "Upload", "Hochladen")}
        </button>
        {onClear && (
          <button type="button" onClick={onClear} className="font-semibold text-rose-600 hover:underline dark:text-rose-400">
            {T("Standartga qaytarish", "Сбросить", "Reset to default", "Zurücksetzen")}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
