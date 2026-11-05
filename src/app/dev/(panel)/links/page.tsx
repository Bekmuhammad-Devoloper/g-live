import { BASE_DOMAIN } from "@/lib/devpanel/registry";
import { readSales } from "@/lib/devpanel/sales";
import { AUTOMATION_LINK_CODE, DEFAULT_LINK_CODE, linkKind } from "@/lib/devpanel/salesTypes";
import LinksView, { type LinkRow } from "./LinksView";

export const dynamic = "force-dynamic";

export default async function SalesLinksPage() {
  const sales = await readSales();

  const stats = new Map<string, { submissions: number; won: number; lastLeadAt: string | null }>();
  for (const l of sales.leads) {
    if (!l.linkCode) continue;
    const s = stats.get(l.linkCode) ?? { submissions: 0, won: 0, lastLeadAt: null };
    s.submissions += 1;
    if (l.status === "WON") s.won += 1;
    if (!s.lastLeadAt || l.createdAt > s.lastLeadAt) s.lastLeadAt = l.createdAt;
    stats.set(l.linkCode, s);
  }

  const rows: LinkRow[] = sales.links.map((l) => {
    const s = stats.get(l.code);
    const views = l.views ?? 0;
    const submissions = s?.submissions ?? 0;
    return {
      code: l.code,
      name: l.name,
      kind: linkKind(l),
      platform: l.platform ?? "other",
      businessType: l.businessType ?? null,
      active: l.active,
      views,
      submissions,
      won: s?.won ?? 0,
      cvr: views > 0 ? Math.round((submissions / views) * 1000) / 10 : null,
      createdAt: l.createdAt,
      lastViewedAt: l.lastViewedAt ?? null,
      lastLeadAt: s?.lastLeadAt ?? null,
      builtin: l.code === DEFAULT_LINK_CODE || l.code === AUTOMATION_LINK_CODE,
    };
  });

  return <LinksView rows={rows} publicBase={`https://${BASE_DOMAIN}`} />;
}
