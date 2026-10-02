"use client";

import { promptDialog } from "../_components/dialogs";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelPayment } from "./actions";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

export default function CancelButton({ id, locale }: { id: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  async function onClick() {
    const reason = await promptDialog({ message: tr(locale, { uz: "Bekor qilish sababi (majburiy, audit uchun):", ru: "Причина отмены (обязательно, для аудита):", en: "Cancellation reason (required, for audit):", de: "Stornierungsgrund (erforderlich, für die Prüfung):" }), minLength: 3, tone: "danger" });
    if (!reason || reason.trim().length < 3) return;
    start(async () => {
      await cancelPayment(id, reason.trim());
      router.refresh();
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "..." : tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
    </button>
  );
}
