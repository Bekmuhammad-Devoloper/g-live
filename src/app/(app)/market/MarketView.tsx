"use client";

import { useState, useTransition } from "react";
import { deleteItem, saveItem, setOrderStatus, toggleItem } from "./actions";

// Market boshqaruvi: sovg'alar ro'yxati (qo'shish/tahrirlash) va buyurtmalar.

export type VItem = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number | null;
  imageUrl: string | null;
  isActive: boolean;
  orders: number;
};

export type VOrder = {
  id: string;
  student: string;
  group: string | null;
  item: string;
  price: number;
  status: string;
  createdAt: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Kutilmoqda", cls: "bg-amber-100 text-amber-800" },
  DELIVERED: { label: "Berildi", cls: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Bekor", cls: "bg-slate-100 text-slate-600" },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

export default function MarketView({
  items,
  orders,
  canEdit,
}: {
  items: VItem[];
  orders: VOrder[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"items" | "orders">(orders.some((o) => o.status === "PENDING") ? "orders" : "items");
  const [edit, setEdit] = useState<VItem | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const pending = orders.filter((o) => o.status === "PENDING").length;

  const submit = (fd: FormData) => {
    setErr(null);
    start(async () => {
      const r = await saveItem(fd);
      if (r.error) setErr(r.error);
      else {
        setOpen(false);
        setEdit(null);
      }
    });
  };

  const act = (fn: () => Promise<{ error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
    });
  };

  return (
    <div className="space-y-4">
      {/* Bo'limlar */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("items")}
          className={
            "rounded-lg px-4 py-2 text-sm font-semibold " +
            (tab === "items" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")
          }
        >
          Sovg&apos;alar ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={
            "rounded-lg px-4 py-2 text-sm font-semibold " +
            (tab === "orders" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")
          }
        >
          Buyurtmalar{pending > 0 ? ` (${pending} yangi)` : ""}
        </button>
        {canEdit && tab === "items" ? (
          <button
            type="button"
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
            className="ml-auto rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            + Sovg&apos;a
          </button>
        ) : null}
      </div>

      {err ? <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{err}</div> : null}

      {/* Forma */}
      {open ? (
        <form action={submit} className="rounded-xl border border-slate-200 bg-white p-4">
          <input type="hidden" name="id" value={edit?.id ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Nomi</span>
              <input name="title" defaultValue={edit?.title ?? ""} required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Narxi (tanga)</span>
              <input name="price" type="number" min={1} defaultValue={edit?.price ?? 100} required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Zaxira (bo&apos;sh = cheksiz)</span>
              <input name="stock" type="number" min={0} defaultValue={edit?.stock ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Rasm havolasi</span>
              <input name="imageUrl" defaultValue={edit?.imageUrl ?? ""} placeholder="/uploads/... yoki https://..." className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">Tavsif</span>
              <textarea name="description" defaultValue={edit?.description ?? ""} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Saqlanmoqda…" : "Saqlash"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEdit(null);
              }}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Bekor
            </button>
          </div>
        </form>
      ) : null}

      {/* Sovg'alar */}
      {tab === "items" ? (
        items.length === 0 ? (
          <Empty text="Hozircha sovg'a qo'shilmagan" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Sovg&apos;a</th>
                  <th className="px-4 py-2.5">Narx</th>
                  <th className="px-4 py-2.5">Zaxira</th>
                  <th className="px-4 py-2.5">Buyurtma</th>
                  <th className="px-4 py-2.5">Holat</th>
                  {canEdit ? <th className="px-4 py-2.5" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-800">{it.title}</div>
                      {it.description ? <div className="text-xs text-slate-500">{it.description}</div> : null}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-700">{it.price}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.stock === null ? "∞" : it.stock}</td>
                    <td className="px-4 py-2.5 text-slate-600">{it.orders}</td>
                    <td className="px-4 py-2.5">
                      <span className={"rounded px-2 py-1 text-xs font-semibold " + (it.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                        {it.isActive ? "Faol" : "Yopiq"}
                      </span>
                    </td>
                    {canEdit ? (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEdit(it);
                              setOpen(true);
                            }}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                          >
                            Tahrir
                          </button>
                          <button
                            type="button"
                            onClick={() => act(() => toggleItem(it.id, !it.isActive))}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                          >
                            {it.isActive ? "Yopish" : "Ochish"}
                          </button>
                          <button
                            type="button"
                            onClick={() => act(() => deleteItem(it.id))}
                            className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600"
                          >
                            O&apos;chirish
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : orders.length === 0 ? (
        <Empty text="Buyurtma yo'q" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Sana</th>
                <th className="px-4 py-2.5">O&apos;quvchi</th>
                <th className="px-4 py-2.5">Sovg&apos;a</th>
                <th className="px-4 py-2.5">Tanga</th>
                <th className="px-4 py-2.5">Holat</th>
                {canEdit ? <th className="px-4 py-2.5" /> : null}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = STATUS[o.status] ?? STATUS.PENDING;
                return (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-800">{o.student}</div>
                      {o.group ? <div className="text-xs text-slate-500">{o.group}</div> : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{o.item}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-700">{o.price}</td>
                    <td className="px-4 py-2.5">
                      <span className={"rounded px-2 py-1 text-xs font-semibold " + st.cls}>{st.label}</span>
                    </td>
                    {canEdit ? (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {o.status !== "DELIVERED" ? (
                            <button
                              type="button"
                              onClick={() => act(() => setOrderStatus(o.id, "DELIVERED"))}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              Berildi
                            </button>
                          ) : null}
                          {o.status !== "CANCELLED" ? (
                            <button
                              type="button"
                              onClick={() => act(() => setOrderStatus(o.id, "CANCELLED"))}
                              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                            >
                              Bekor
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
