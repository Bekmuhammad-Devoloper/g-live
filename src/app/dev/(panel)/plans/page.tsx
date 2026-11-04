import { readRegistry } from "@/lib/devpanel/registry";
import { readSales } from "@/lib/devpanel/sales";
import PlansEditor from "./PlansEditor";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [sales, reg] = await Promise.all([readSales(), readRegistry()]);
  const usage: Record<string, number> = {};
  for (const c of reg.centers) {
    if (c.status !== "active" && c.status !== "provisioning") continue;
    const key = c.plan.toLowerCase();
    usage[key] = (usage[key] ?? 0) + 1;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tariflar</h1>
        <p className="mt-1 text-sm text-slate-500">Oylik obuna narxlari. Saqlangach, ochiq ariza sahifasida darhol yangilanadi.</p>
      </div>
      <PlansEditor plans={sales.plans} usage={usage} />
    </div>
  );
}
