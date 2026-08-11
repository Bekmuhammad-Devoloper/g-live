import { z } from "zod";

// ROP KPI sozlamalari sxemasi va standart qiymatlari.
// (Alohida fayl — "use server" actions.ts faqat funksiya eksport qila oladi.)

export const ROP_KPI_KEY = "rop.kpi";

export const kpiSettingsSchema = z.object({
  dailyMinLeads: z.coerce.number().int().min(0).max(1000),
  targetConversion: z.coerce.number().int().min(0).max(100),
  bonusThreshold: z.coerce.number().int().min(0).max(100),
  penaltyThreshold: z.coerce.number().int().min(0).max(100),
  autoDistribution: z.boolean(),
  highKpiMoreLeads: z.boolean(),
  monthlyPayments: z.array(z.object({ month: z.coerce.number().int().min(1).max(120), amount: z.coerce.number().int().min(0) })).max(24),
});

export type RopKpiSettings = z.infer<typeof kpiSettingsSchema>;

export const DEFAULT_KPI: RopKpiSettings = {
  dailyMinLeads: 10,
  targetConversion: 30,
  bonusThreshold: 50,
  penaltyThreshold: 15,
  autoDistribution: true,
  highKpiMoreLeads: true,
  monthlyPayments: [{ month: 1, amount: 100000 }],
};
