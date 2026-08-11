"use client";

// Click-to-call — istalgan joydan (lid, kontakt) softphone'ga qo'ng'iroq beradi.
// Softphone `glive:call` window hodisasini tinglaydi va AMI Originate yuboradi.
import { Icon } from "./Icon";

export default function CallButton({ number, leadId, contactName, label, className }: {
  number: string; leadId?: string; contactName?: string; label?: string; className?: string;
}) {
  const call = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!number) return;
    window.dispatchEvent(new CustomEvent("glive:call", { detail: { number, leadId, contactName } }));
  };
  return (
    <button
      onClick={call}
      title="Qo'ng'iroq"
      className={className ?? "inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"}
    >
      <Icon name="phoneCall" className="h-4 w-4" />
      {label}
    </button>
  );
}
