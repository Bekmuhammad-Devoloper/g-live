import { BASE_DOMAIN, readRegistry } from "@/lib/devpanel/registry";
import { readSales } from "@/lib/devpanel/sales";
import PlansEditor from "./PlansEditor";
import PromosEditor from "./PromosEditor";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [sales, reg] = await Promise.all([readSales(), readRegistry()]);
  const usage: Record<string, number> = {};
  for (const c of reg.centers) {
    if (c.status !== "active" && c.status !== "provisioning") continue;
    const key = c.plan.toLowerCase();
    usage[key] = (usage[key] ?? 0) + 1;
  }
  const uses: Record<string, number> = {};
  for (const l of sales.leads) {
    if (l.promoCode) uses[l.promoCode] = (uses[l.promoCode] ?? 0) + 1;
  }
  const link = sales.links.find((l) => l.active);
  return (
    <div className="space-y-8">
      <PlansEditor plans={sales.plans} usage={usage} publicUrl={link ? `https://${BASE_DOMAIN}/apply/${link.code}` : null} />
      <PromosEditor promos={sales.promos} uses={uses} />
    </div>
  );
}
