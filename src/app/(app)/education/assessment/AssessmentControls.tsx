"use client";

import { useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import NewAssessmentForm from "./NewAssessmentForm";

export default function AssessmentControls({ groups, locale }: { groups: { id: string; name: string }[]; locale: Locale }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })}
      </button>

      <button
        onClick={() => setOpen(true)}
        title={tr(locale, { uz: "Yangi baholash", ru: "Новое оценивание", en: "New assessment", de: "Neue Bewertung" })}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition hover:scale-105 hover:bg-brand-700"
      >
        <Icon name="plus" className="h-5 w-5" />
      </button>

      <NewAssessmentForm groups={groups} open={open} onClose={() => setOpen(false)} locale={locale} />
    </>
  );
}
