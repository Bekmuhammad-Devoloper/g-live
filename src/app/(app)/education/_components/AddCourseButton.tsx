"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import CourseFormDrawer from "../../courses/CourseFormDrawer";
import { saveMetaFor } from "../../courses/shared";

// Education bo'limida "Kurs qo'shish" — mavjud kurs (Program) formasini qayta ishlatadi.
export default function AddCourseButton({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Kurs qo'shish", ru: "Добавить курс", en: "Add course" })}
      </button>
      <CourseFormDrawer
        mode="create"
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(id, meta) => { saveMetaFor(id, meta); router.refresh(); }}
      />
    </>
  );
}
