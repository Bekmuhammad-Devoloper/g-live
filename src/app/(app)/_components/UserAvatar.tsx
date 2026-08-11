"use client";

import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

// Foydalanuvchi avatari — rasm yuklangan bo'lsa rasm, aks holda ROL ikonasi.
// Ilgari har bir sahifa o'zicha ism harflarini (masalan "AK") chizardi;
// endi hamma joyda shu komponent ishlatiladi.

// Har bir rol uchun ikonka va rang
const ROLE_LOOK: Record<string, { icon: string; ring: string }> = {
  MANAGER:         { icon: "headphones", ring: "from-brand-500 to-brand-700" },      // operator
  TEACHER:         { icon: "teacher",    ring: "from-violet-500 to-purple-700" },
  STUDENT:         { icon: "graduation", ring: "from-sky-500 to-blue-700" },
  PARENT:          { icon: "users",      ring: "from-teal-500 to-emerald-700" },
  ACCOUNTANT:      { icon: "wallet",     ring: "from-amber-500 to-orange-600" },
  DEPUTY_DIRECTOR: { icon: "shield",     ring: "from-indigo-500 to-indigo-700" },
  DIRECTOR:        { icon: "shieldCheck", ring: "from-slate-600 to-slate-800" },
  ADMIN:           { icon: "settings",   ring: "from-slate-600 to-slate-800" },
};
// Rol noma'lum bo'lsa (lid, mijoz, tashqi kontakt)
const FALLBACK = { icon: "user", ring: "from-slate-400 to-slate-600" };

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE: Record<AvatarSize, { box: string; icon: string; radius: string }> = {
  xs: { box: "h-7 w-7",   icon: "h-3.5 w-3.5", radius: "rounded-lg" },
  sm: { box: "h-9 w-9",   icon: "h-4 w-4",     radius: "rounded-lg" },
  md: { box: "h-11 w-11", icon: "h-5 w-5",     radius: "rounded-xl" },
  lg: { box: "h-12 w-12", icon: "h-6 w-6",     radius: "rounded-2xl" },
  xl: { box: "h-20 w-20", icon: "h-9 w-9",     radius: "rounded-2xl" },
};

interface Props {
  name?: string | null;
  imageUrl?: string | null;
  /** ROLES dagi qiymat. Berilmasa — umumiy "odam" ikonasi */
  role?: string | null;
  size?: AvatarSize;
  className?: string;
}

export default function UserAvatar({ name, imageUrl, role, size = "md", className }: Props) {
  const s = SIZE[size];
  const look = (role && ROLE_LOOK[role]) || FALLBACK;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? ""}
        className={cn(s.box, s.radius, "shrink-0 object-cover shadow-sm", className)}
      />
    );
  }

  return (
    <span
      title={name ?? undefined}
      className={cn(
        s.box, s.radius,
        "grid shrink-0 place-items-center bg-gradient-to-br text-white shadow-sm",
        look.ring,
        className,
      )}
    >
      <Icon name={look.icon} className={s.icon} />
    </span>
  );
}
