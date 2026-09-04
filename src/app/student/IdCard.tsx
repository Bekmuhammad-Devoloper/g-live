"use client";

import { useRef, useState, useTransition } from "react";
import type { StudentStrings } from "./_i18n";
import { FlagAvatar, ICON_GRADIENT, TEAL } from "./_ui";
import { removePhoto, updateProfile } from "./profileActions";

// O'quvchi guvohnomasi — ID-karta ko'rinishidagi shaxsiy ma'lumot.
// Rasm, ism, tug'ilgan sana va telefonlarni o'quvchining o'zi tahrirlaydi;
// guruh va daraja o'quv jarayoni ma'lumoti bo'lgani uchun faqat ko'rinadi.
// ATAYIN shisha (.gl-glass) EMAS: bu bosma guvohnoma taqlidi — qattiq oq fon
// va o'z soyasi saqlanadi, shunda haqiqiy plastik kartadek ko'rinadi.

export type VProfile = {
  fullName: string;
  birthDate: string | null; // yyyy-mm-dd
  age: number | null;
  phone: string | null;
  phone2: string | null;
  imageUrl: string | null;
  level: string;
  group: string | null;
  login: string;
  studentNo: string;
  status?: string | null;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export default function IdCard({ p, t, editable = true }: { p: VProfile; t: StudentStrings; editable?: boolean }) {
  const [edit, setEdit] = useState(false);
  const [img, setImg] = useState(p.imageUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Telefon surati 3–5 MB bo'ladi; guvohnoma uchun shuncha kerak emas —
  // yuklashdan oldin brauzerda 900px gacha kichraytiramiz.
  const shrink = (f: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        const max = 900;
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(im, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85);
      };
      im.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image"));
      };
      im.src = url;
    });

  const pickPhoto = async (f: File) => {
    setMsg(null);
    setUploading(true);
    try {
      let body: Blob = f;
      let name = f.name;
      try {
        body = await shrink(f);
        name = "photo.jpg";
      } catch {
        // kichraytirib bo'lmasa (masalan HEIC) — aslini yuboramiz
      }
      const fd = new FormData();
      fd.append("file", new File([body], name, { type: body.type || f.type }));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error ?? "upload");
      setImg(j.url);
    } catch {
      setMsg({ ok: false, text: t.tryAgain });
    } finally {
      setUploading(false);
    }
  };

  const submit = (fd: FormData) => {
    setMsg(null);
    fd.set("imageUrl", img ?? "");
    start(async () => {
      const r = await updateProfile(fd);
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t.saved });
        setEdit(false);
      }
    });
  };

  const dropPhoto = () => {
    setImg(null);
    start(async () => {
      await removePhoto();
    });
  };

  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_30px_rgba(19,78,94,0.14)]">
      {/* Karta boshi — guvohnoma sarlavhasi */}
      <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: ICON_GRADIENT }}>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.18em]">Germaniya Live</span>
        <span className="font-mono text-[11px] font-bold text-white/80">ID {p.studentNo}</span>
      </div>

      <div className="p-4">
        <div className="flex gap-4">
          {/* Rasm */}
          <div className="shrink-0">
            <div className="h-[104px] w-[82px] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={p.fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center">
                  <FlagAvatar s={54} id="glIdAvatar" />
                </span>
              )}
            </div>
            {/* Yosh va daraja — rasm ostida, o'ng ustunga joy qolsin */}
            {!edit ? (
              <div className="mt-2 space-y-1.5">
                <Chip k={t.age} v={p.age !== null ? String(p.age) : "—"} />
                <Chip k={t.level} v={p.level} />
              </div>
            ) : null}

            {edit ? (
              <div className="mt-1.5 flex flex-col gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickPhoto(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 disabled:opacity-50"
                >
                  {uploading ? "…" : t.photo}
                </button>
                {img ? (
                  <button type="button" onClick={dropPhoto} className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600">
                    {t.removePhoto}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Ma'lumotlar */}
          <div className="min-w-0 flex-1">
            {edit ? (
              <form action={submit} className="space-y-2">
                <Field label={t.fullName}>
                  <input name="fullName" autoComplete="name" defaultValue={p.fullName} required className={INPUT} />
                </Field>
                <Field label={t.birthDate}>
                  <input name="birthDate" type="date" defaultValue={p.birthDate ?? ""} className={INPUT} />
                </Field>
                <Field label={t.phone}>
                  <input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={p.phone ?? ""} placeholder="90 123 45 67" className={INPUT} />
                </Field>
                <Field label={t.phone2}>
                  <input name="phone2" type="tel" inputMode="tel" autoComplete="tel" defaultValue={p.phone2 ?? ""} placeholder="—" className={INPUT} />
                </Field>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-xl py-2 text-[13px] font-bold text-white disabled:opacity-60"
                    style={{ background: TEAL }}
                  >
                    {busy ? "…" : t.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEdit(false);
                      setImg(p.imageUrl);
                      setMsg(null);
                    }}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-[13px] font-bold text-slate-500"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="break-words text-[18px] font-extrabold leading-tight text-slate-900">{p.fullName}</div>
                {p.status ? (
                  <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-[2px] text-[11px] font-bold text-emerald-700">
                    {p.status}
                  </span>
                ) : null}
                <dl className="mt-2 space-y-1">
                  <Line k={t.birthDate} v={fmtDate(p.birthDate)} />
                  <Line k={t.group} v={p.group ?? "—"} />
                  <Line k={t.phone} v={p.phone ?? "—"} />
                  {p.phone2 ? <Line k={t.phone2} v={p.phone2} /> : null}
                  <Line k={t.login} v={p.login} mono />
                </dl>
              </>
            )}
          </div>
        </div>

        {msg ? (
          <p className={"mt-3 text-[12.5px] font-semibold " + (msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.text}</p>
        ) : null}

        {!edit && editable ? (
          <button
            type="button"
            onClick={() => setEdit(true)}
            className="mt-3 w-full rounded-xl bg-slate-50 py-2.5 text-[13.5px] font-bold text-slate-600"
          >
            {t.editProfile}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border-0 bg-slate-50 px-3 py-2 text-[16px] font-semibold text-slate-800 outline-none focus:bg-slate-100 focus:ring-2 focus:ring-[#0e7490]/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}

// Guvohnoma qatori — yorliq chapda, qiymat o'ngda.
// Qiymat kesilmaydi: sig'masa butunlay keyingi qatorga tushadi
// (uzun telefon raqami yoki guruh nomi to'liq ko'rinishi uchun).
// Rasm ostidagi ixcham qiymat (yosh, daraja)
function Chip({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-1.5 py-1.5 text-center">
      <div className="text-[9px] font-bold uppercase tracking-[0.04em] text-slate-400">{k}</div>
      <div className="mt-[1px] truncate text-[14px] font-extrabold leading-none text-slate-800">{v}</div>
    </div>
  );
}

function Line({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5">
      <dt className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-400">{k}</dt>
      <dd className={"ml-auto break-words text-right text-[13.5px] font-bold text-slate-800" + (mono ? " font-mono text-[12.5px]" : "")}>
        {v}
      </dd>
    </div>
  );
}
