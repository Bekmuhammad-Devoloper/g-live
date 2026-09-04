import Link from "next/link";
import { TEAL } from "../_ui";

// Sarlavhadagi graf tugmasi — bog'lanishlar xaritasini ochadi.
export default function GraphButton({ title }: { title: string }) {
  return (
    <Link
      href="/student/gehirn/graph"
      aria-label={title}
      title={title}
      className="gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:translate-y-[1px]"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2.4" />
        <circle cx="5" cy="17" r="2.4" />
        <circle cx="19" cy="17" r="2.4" />
        <path d="M10.4 6.9 6.6 14.9M13.6 6.9l3.8 8M7.4 17h9.2" />
      </svg>
    </Link>
  );
}
