"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRead, markAllRead } from "../../(app)/notifications/actions";
import { CARD, TEAL, IcoBell } from "../_ui";

// Bildirishnomalar ro'yxati — o'qilmagani bosilganda o'qilgan deb belgilanadi.
// markRead/markAllRead faqat o'z yozuvlarini yangilaydi (userId bilan himoyalangan).

export interface VNotif {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string; // ISO
}

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NotifList({ items }: { items: VNotif[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const unread = items.filter((n) => !n.isRead).length;

  if (items.length === 0) {
    return (
      <div className={`${CARD} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#eef6fa]"><IcoBell s={26} /></span>
        <div className="text-[17px] font-extrabold text-slate-900">Keine Mitteilungen</div>
        <p className="text-[13px] text-slate-500">Hozircha xabar yo&apos;q.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <button
          onClick={() => start(async () => { await markAllRead(); router.refresh(); })}
          className="w-full rounded-2xl bg-white py-3 text-[13px] font-bold shadow-[0_6px_16px_rgba(19,78,94,0.10)]"
          style={{ color: TEAL }}
        >
          Alle als gelesen markieren ({unread})
        </button>
      )}

      <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => { if (!n.isRead) start(async () => { await markRead(n.id); router.refresh(); }); }}
            className="flex w-full items-start gap-3 py-3.5 text-left"
          >
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.isRead ? "bg-slate-200" : ""}`} style={n.isRead ? undefined : { background: TEAL }} />
            <div className="min-w-0 flex-1">
              <div className={`text-[13.5px] leading-snug ${n.isRead ? "font-semibold text-slate-500" : "font-bold text-slate-900"}`}>{n.title}</div>
              {n.body && <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-500">{n.body}</p>}
              <div className="mt-1 text-[11px] text-slate-400">{fmt(n.createdAt)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
