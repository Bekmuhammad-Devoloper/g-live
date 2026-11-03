"use client";

import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { canonicalSipExtension, type SipOption } from "@/lib/sip";

export default function SipSelect({ locale, options, current, className, canRelease = true }: { locale: Locale; options: SipOption[]; current?: string | null; className?: string; canRelease?: boolean }) {
  const ext = canonicalSipExtension(current);
  const canonical = ext && options.some((o) => o.ext === ext) ? ext : null;
  const invalid = current && !canonical ? current : null;
  return (
    <select name="sipExtension" defaultValue={canonical ?? invalid ?? ""} className={className}>
      <option value="">{tr(locale, { uz: "— telefonsiz —", ru: "— без телефона —", en: "— no phone —", de: "— kein Telefon —" })}</option>
      {invalid && (
        <option value={invalid}>
          {invalid} — {tr(locale, { uz: "noto'g'ri, boshqasini tanlang", ru: "неверный, выберите другой", en: "invalid, choose another", de: "ungültig, bitte andere wählen" })}
        </option>
      )}
      {options.map((o) => {
        const mine = o.ext === canonical;
        const takenByActive = !!o.owner && o.ownerActive && !mine;
        const lockedArchived = !!o.owner && !o.ownerActive && !mine && !canRelease;
        const archivedHint = canRelease
          ? tr(locale, { uz: "ishdan ketgan, bo'shatiladi", ru: "уволен, освободится", en: "left, will be freed", de: "ausgeschieden, wird frei" })
          : tr(locale, { uz: "ishdan ketgan — direktor bo'shatadi", ru: "уволен — освобождает директор", en: "left — a director must free it", de: "ausgeschieden — Direktor gibt frei" });
        const hint = mine
          ? tr(locale, { uz: "hozirgi", ru: "текущий", en: "current", de: "aktuell" })
          : o.owner
            ? `${o.owner}${o.ownerActive ? "" : ` · ${archivedHint}`}`
            : tr(locale, { uz: "bo'sh", ru: "свободен", en: "free", de: "frei" });
        return <option key={o.ext} value={o.ext} disabled={takenByActive || lockedArchived}>{o.ext} — {hint}</option>;
      })}
    </select>
  );
}
