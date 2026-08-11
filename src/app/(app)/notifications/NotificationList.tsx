"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRead } from "./actions";

export interface NotifItem {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  date: string;
}

// Bildirishnomalar ro'yxati — o'qilmagan yozuvni bosganda o'qilgan deb belgilaydi.
export default function NotificationList({ items, readHint }: { items: NotifItem[]; readHint: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div
          key={n.id}
          onClick={() => {
            if (n.isRead || pending) return;
            start(async () => {
              await markRead(n.id);
              router.refresh();
            });
          }}
          title={n.isRead ? undefined : readHint}
          className={`rounded-xl border p-4 shadow-sm transition ${
            n.isRead
              ? "border-slate-200 bg-white"
              : "cursor-pointer border-brand-200 bg-brand-50 hover:border-brand-300"
          } ${pending ? "opacity-70" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                <span className="font-medium text-slate-800">{n.title}</span>
              </div>
              {n.body && <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>}
            </div>
            <span className="shrink-0 text-xs text-slate-400">{n.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
