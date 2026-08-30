import { kindColor } from "./parse";

// Yozuv turi ikonkalari — portalning chiziqli uslubida.
// NOTE varaq · IDEA lampochka · GOAL nishon · BOOK kitob · PERSON odam · DAILY kalendar

export default function KindIcon({ kind, s = 20, c }: { kind: string; s?: number; c?: string }) {
  const col = c ?? kindColor(kind);
  const base = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: col, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };

  if (kind === "IDEA") {
    return (
      <svg {...base}>
        <path d="M9 17.5h6M10 20.5h4" />
        <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.7h5.4c.1-.7.4-1.3.9-1.7A6 6 0 0 0 12 3Z" />
      </svg>
    );
  }
  if (kind === "GOAL") {
    return (
      <svg {...base}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.6" />
        <circle cx="12" cy="12" r="1.4" fill={col} stroke="none" />
      </svg>
    );
  }
  if (kind === "BOOK") {
    return (
      <svg {...base}>
        <path d="M12 6c-1.5-1.6-3.6-2.2-6-2.2-1 0-2 .15-3 .45V19c1-.3 2-.45 3-.45 2.4 0 4.5.6 6 2.2 1.5-1.6 3.6-2.2 6-2.2 1 0 2 .15 3 .45V4.25c-1-.3-2-.45-3-.45-2.4 0-4.5.6-6 2.2Z" />
        <path d="M12 6v14.75" />
      </svg>
    );
  }
  if (kind === "PERSON") {
    return (
      <svg {...base}>
        <circle cx="12" cy="7.8" r="3.3" />
        <path d="M4.8 20.2c.9-3.5 3.7-5.3 7.2-5.3s6.3 1.8 7.2 5.3" />
      </svg>
    );
  }
  if (kind === "DAILY") {
    return (
      <svg {...base}>
        <rect x="3.5" y="5" width="17" height="16" rx="3" />
        <path d="M3.5 10h17M8.5 2.8V7M15.5 2.8V7" />
        <circle cx="12" cy="15" r="1.4" fill={col} stroke="none" />
      </svg>
    );
  }
  // NOTE (standart)
  return (
    <svg {...base}>
      <path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5Z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 16h4" />
    </svg>
  );
}
