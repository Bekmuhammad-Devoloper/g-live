import Link from "next/link";

// Izoh ustunidagi guruh belgisi — guruh sahifasiga havola.
export default function GroupBadge({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/groups/${id}`} className="inline-flex max-w-full items-center truncate rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25">
      {name}
    </Link>
  );
}
