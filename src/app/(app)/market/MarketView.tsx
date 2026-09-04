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
  /** null = barcha filiallar uchun */
  branchName: string | null;
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
            <ImagePicker key={edit?.id ?? "new"} initial={edit?.imageUrl ?? null} />
            <label className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="allBranches"
                value="1"
                defaultChecked={edit ? edit.branchName === null : true}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="font-medium text-slate-600">Barcha filiallar uchun</span>
              <span className="text-xs text-slate-400">
                belgilanmasa — faqat joriy filial o&apos;quvchilariga ko&apos;rinadi
                {edit?.branchName ? ` (hozir: ${edit.branchName})` : ""}
              </span>
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
                      <div className="flex items-center gap-3">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
                        ) : null}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800">{it.title}</div>
                          {it.description ? <div className="text-xs text-slate-500">{it.description}</div> : null}
                          <div className="text-[11px] text-slate-400">
                            {it.branchName ? `Faqat: ${it.branchName}` : "Barcha filiallar"}
                          </div>
                        </div>
                      </div>
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

// Sovg'a surati: kompyuterdan yuklash yoki havola kiritish.
// Rasm qo'yilmasa o'quvchi tomonida nomiga mos belgi chiziladi (ItemCard).
function ImagePicker({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (file: File) => {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", new File([await shrink(file)], "sovga.jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error("upload");
      setUrl(j.url as string);
    } catch {
      setErr("Rasmni yuklab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-sm sm:col-span-2">
      <span className="mb-1 block font-medium text-slate-600">Surati (ixtiyoriy)</span>
      <input type="hidden" name="imageUrl" value={url ?? ""} />
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-slate-400">rasm yo&apos;q</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">
              {busy ? "Yuklanmoqda…" : url ? "Almashtirish" : "Rasm yuklash"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void pick(f);
                }}
              />
            </label>
            {url ? (
              <button
                type="button"
                onClick={() => setUrl(null)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                O&apos;chirish
              </button>
            ) : null}
          </div>
          <input
            value={url ?? ""}
            onChange={(e) => setUrl(e.target.value.trim() || null)}
            placeholder="yoki havola: /uploads/... https://..."
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          />
          {err ? <p className="text-xs font-medium text-rose-600">{err}</p> : null}
        </div>
      </div>
    </div>
  );
}

// Katta suratni brauzerda kichraytiramiz — 800px sovg'a kartochkasiga yetarli
function shrink(f: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(src);
      const k = Math.min(1, 800 / im.width);
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.86);
    };
    im.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("image"));
    };
    im.src = src;
  });
}
