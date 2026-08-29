"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";

// "Yangilash" tugmasi shunchaki sahifani qayta yuklamaydi — avval Asterisk
// CDR'idan yangi qo'ng'iroqlarni tortib oladi. Shu tufayli noutbuk o'chiq
// bo'lgan paytdagi qo'ng'iroqlar ham ro'yxatga tushadi.
export function useCdrSync(locale: Locale) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  // silent — sahifa ochilganda fonda ishlaydigan avtomatik sinxronizatsiya:
  // yangi qo'ng'iroq topilmasa foydalanuvchini bezovta qilmaydi.
  const run = useCallback(
    async (silent: boolean) => {
      setSyncing(true);
      if (!silent) setNote(null);
      let changed = false;
      try {
        const res = await fetch("/api/telephony/sync-cdr", { method: "POST" });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; created?: number; updated?: number; error?: string }
          | null;

        if (data?.ok) {
          const n = data.created ?? 0;
          changed = n > 0;
          if (!silent || changed) {
            setNote({
              text: changed
                ? tr(locale, { uz: `${n} ta yangi qo'ng'iroq qo'shildi`, ru: `Добавлено ${n} новых звонков`, en: `${n} new call(s) added`, de: `${n} neue(r) Anruf(e) hinzugefügt` })
                : tr(locale, { uz: "Yangi qo'ng'iroq yo'q", ru: "Новых звонков нет", en: "No new calls", de: "Keine neuen Anrufe" }),
            });
          }
        } else if (!silent) {
          setNote({ text: data?.error ?? tr(locale, { uz: "Sinxronizatsiya amalga oshmadi", ru: "Синхронизация не удалась", en: "Sync failed", de: "Synchronisierung fehlgeschlagen" }), error: true });
        }
      } catch {
        if (!silent) setNote({ text: tr(locale, { uz: "Serverga ulanib bo'lmadi", ru: "Не удалось подключиться к серверу", en: "Could not reach the server", de: "Server konnte nicht erreicht werden" }), error: true });
      } finally {
        setSyncing(false);
        // Jim rejimda faqat yangilik bo'lsa qayta yuklaymiz
        if (!silent || changed) router.refresh();
        setTimeout(() => setNote(null), 4000);
      }
    },
    [locale, router],
  );

  const sync = useCallback(() => { if (!syncing) void run(false); }, [run, syncing]);

  // Sahifa ochilganda bir marta — ma'lumot doim dolzarb bo'lishi uchun
  useEffect(() => { void run(true); }, [run]);

  return { sync, syncing, note };
}
