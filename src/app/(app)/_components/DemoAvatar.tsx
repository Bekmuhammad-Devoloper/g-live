import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export default function DemoAvatar({ size = 40, ringColor, className, src }: { size?: number; ringColor?: string; className?: string; src?: string }) {
  const style = { width: size, height: size, ...(ringColor ? { "--tw-ring-color": ringColor } : {}) } as CSSProperties;
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700",
        ringColor && "ring-2",
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
        <circle cx="32" cy="25" r="11.5" className="fill-white dark:fill-slate-300" />
        <path d="M9 66c0-14.6 10.3-24.5 23-24.5S55 51.4 55 66z" className="fill-white dark:fill-slate-300" />
      </svg>
      <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: src ? `url("${src}")` : "var(--lead-avatar)" }} />
    </span>
  );
}
