import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { computeDebts } from "@/lib/debt";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { LEAD_STAGE_LABELS, PAYMENT_METHOD_LABELS, ROLE_LABELS, label } from "@/lib/constants";

export interface AiActor { userId: string; fullName: string; role: string }

const DAY = 86_400_000;
const ymd = /^\d{4}-\d{2}-\d{2}$/;

function range(from?: string, to?: string): { start: Date; end: Date; label: string } {
  const today = new Date();
  const f = from && ymd.test(from) ? new Date(`${from}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const t = to && ymd.test(to) ? new Date(`${to}T00:00:00`) : new Date(f);
  const end = new Date(t.getTime() + DAY);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: f, end, label: `${iso(f)} — ${iso(t)}` };
}

async function resolveBranch(name?: string): Promise<{ id: string; name: string } | null | "notfound"> {
  if (!name?.trim()) return null;
  const all = await prisma.branch.findMany({ select: { id: true, name: true } });
  const q = name.trim().toLowerCase();
  return all.find((b) => b.name.toLowerCase() === q) ?? all.find((b) => b.name.toLowerCase().includes(q)) ?? "notfound";
}

const dateProps = {
  from: { type: "string", description: "Boshlanish sanasi YYYY-MM-DD (bo'sh bo'lsa bugun)" },
  to: { type: "string", description: "Tugash sanasi YYYY-MM-DD (bo'sh bo'lsa 'from' bilan bir xil)" },
} as const;
const branchProp = { branch: { type: "string", description: "Filial nomi (ixtiyoriy). Bo'sh bo'lsa barcha filiallar." } } as const;

export const AI_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_branches",
    description: "Barcha filiallar ro'yxati (nomi, faolligi, o'quvchilar va xodimlar soni).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "finance_summary",
    description: "Davr bo'yicha moliya: tushum (to'langan to'lovlar), to'lov turlari va filiallar kesimida, xarajatlar, qaytarilgan pullar va sof foyda. 'Bugun qancha tushum bo'ldi' kabi savollar uchun.",
    input_schema: { type: "object", properties: { ...dateProps, ...branchProp } },
  },
  {
    name: "leads_summary",
    description: "Davr bo'yicha yangi lidlar: jami, bosqich, manba, mas'ul operator va filial kesimida.",
    input_schema: { type: "object", properties: { ...dateProps, ...branchProp } },
  },
  {
    name: "debtors_summary",
    description: "Qarzdorlar: har filialda qarzdorlar soni va jami qarz, eng katta qarzdorlar ro'yxati (ism, telefon, guruh, qarz).",
    input_schema: { type: "object", properties: { ...branchProp, limit: { type: "integer", description: "Eng katta qarzdorlardan nechtasi (standart 10, maks 50)" } } },
  },
  {
    name: "students_summary",
    description: "O'quvchilar holati (holatlar bo'yicha soni), faol guruhlar va davr ichida qo'shilgan yangi o'quvchilar.",
    input_schema: { type: "object", properties: { ...dateProps, ...branchProp } },
  },
  {
    name: "find_staff",
    description: "Xodimlarni qidirish (ism yoki rol bo'yicha). Topshiriq berish yoki faoliyatini ko'rish uchun xodim id sini olishda ishlating.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Ism yoki uning bir qismi (ixtiyoriy)" },
        role: { type: "string", description: "Rol kodi (ixtiyoriy): DIRECTOR, DEPUTY_DIRECTOR, MANAGER, ADMIN, ROP, OPERATOR, TEACHER, ACCOUNTANT" },
      },
    },
  },
  {
    name: "staff_activity",
    description: "Xodimning davr ichidagi faoliyati: tizimdagi amallar, lidlar bilan ishlash, qo'ng'iroqlar, qabul qilgan to'lovlari, topshiriqlari, oxirgi kirishi.",
    input_schema: { type: "object", properties: { userId: { type: "string", description: "Xodim id si (find_staff dan)" }, ...dateProps }, required: ["userId"] },
  },
  {
    name: "list_tasks",
    description: "Topshiriqlar ro'yxati (ixtiyoriy: xodim va holat bo'yicha).",
    input_schema: {
      type: "object",
      properties: {
        assigneeId: { type: "string", description: "Xodim id si (ixtiyoriy)" },
        status: { type: "string", enum: ["OPEN", "DONE"], description: "Holat (ixtiyoriy)" },
      },
    },
  },
  {
    name: "create_task",
    description: "Xodimga topshiriq berish (Topshiriqlar bo'limiga yoziladi va xodimga bildirishnoma boradi). Faqat foydalanuvchi aniq so'raganda ishlating; avval find_staff bilan xodim id sini aniqlang.",
    input_schema: {
      type: "object",
      properties: {
        assigneeId: { type: "string", description: "Mas'ul xodim id si" },
        title: { type: "string", description: "Topshiriq matni (qisqa va aniq)" },
        note: { type: "string", description: "Qo'shimcha izoh (ixtiyoriy)" },
        dueAt: { type: "string", description: "Muddat YYYY-MM-DD yoki YYYY-MM-DDTHH:mm (ixtiyoriy)" },
        priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH"], description: "Muhimlik (standart NORMAL)" },
      },
      required: ["assigneeId", "title"],
    },
  },
];

const L = (t: Record<string, { uz: string }> , k: string) => label(t as never, k, "uz");

async function listBranches() {
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true, _count: { select: { students: true, users: true } } } });
  return branches.map((b) => ({ name: b.name, active: b.isActive, students: b._count.students, staff: b._count.users }));
}

async function financeSummary(i: { from?: string; to?: string; branch?: string }) {
  const r = range(i.from, i.to);
  const br = await resolveBranch(i.branch);
  if (br === "notfound") return { error: `"${i.branch}" filiali topilmadi` };
  const stuBranch = br ? { student: { branchId: br.id } } : {};
  const [paid, refunded, expenses, branches] = await Promise.all([
    prisma.payment.findMany({ where: { status: "PAID", createdAt: { gte: r.start, lt: r.end }, ...stuBranch }, select: { amount: true, method: true, student: { select: { branchId: true } } } }),
    prisma.payment.aggregate({ where: { status: "REFUNDED", createdAt: { gte: r.start, lt: r.end }, ...stuBranch }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { date: { gte: r.start, lt: r.end }, ...(br ? { branchId: br.id } : {}) }, _sum: { amount: true }, _count: true }),
    prisma.branch.findMany({ select: { id: true, name: true } }),
  ]);
  const bname = new Map(branches.map((b) => [b.id, b.name]));
  const byMethod: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  let revenue = 0;
  for (const p of paid) {
    revenue += p.amount;
    const m = L(PAYMENT_METHOD_LABELS as never, p.method) || p.method;
    byMethod[m] = (byMethod[m] ?? 0) + p.amount;
    const b = bname.get(p.student?.branchId ?? "") ?? "Filialsiz";
    byBranch[b] = (byBranch[b] ?? 0) + p.amount;
  }
  const exp = expenses._sum.amount ?? 0;
  const ref = refunded._sum.amount ?? 0;
  return {
    period: r.label, branch: br?.name ?? "Barcha filiallar",
    revenue, paymentsCount: paid.length, byMethod, byBranch: br ? undefined : byBranch,
    expenses: exp, expensesCount: expenses._count, refunds: ref, refundsCount: refunded._count,
    netProfit: revenue - exp - ref, currency: "so'm",
  };
}

async function leadsSummary(i: { from?: string; to?: string; branch?: string }) {
  const r = range(i.from, i.to);
  const br = await resolveBranch(i.branch);
  if (br === "notfound") return { error: `"${i.branch}" filiali topilmadi` };
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: r.start, lt: r.end }, ...(br ? { branchId: br.id } : {}) },
    select: { stage: true, source: true, manager: { select: { fullName: true } }, branch: { select: { name: true } } },
  });
  const count = (f: (l: (typeof leads)[number]) => string) => leads.reduce<Record<string, number>>((a, l) => { const k = f(l); a[k] = (a[k] ?? 0) + 1; return a; }, {});
  return {
    period: r.label, branch: br?.name ?? "Barcha filiallar", total: leads.length,
    byStage: count((l) => L(LEAD_STAGE_LABELS as never, l.stage) || l.stage),
    bySource: count((l) => l.source || "Noma'lum"),
    byManager: count((l) => l.manager?.fullName ?? "Biriktirilmagan"),
    byBranch: br ? undefined : count((l) => l.branch?.name ?? "Filialsiz"),
  };
}

async function debtorsSummary(i: { branch?: string; limit?: number }) {
  const br = await resolveBranch(i.branch);
  if (br === "notfound") return { error: `"${i.branch}" filiali topilmadi` };
  const students = await prisma.student.findMany({
    where: br ? { branchId: br.id } : {},
    select: {
      id: true, fullName: true, phone: true, branch: { select: { name: true } },
      enrollments: { take: 1, orderBy: { joinedAt: "desc" }, select: { group: { select: { name: true } } } },
    },
  });
  const debts = await computeDebts(students.map((s) => s.id));
  const perBranch: Record<string, { debtors: number; totalDebt: number }> = {};
  const rows: { name: string; phone: string; branch: string; group: string | null; debt: number }[] = [];
  for (const s of students) {
    const d = debts.get(s.id)?.debt ?? 0;
    if (d <= 0) continue;
    const b = s.branch?.name ?? "Filialsiz";
    perBranch[b] ??= { debtors: 0, totalDebt: 0 };
    perBranch[b].debtors++; perBranch[b].totalDebt += d;
    rows.push({ name: s.fullName, phone: s.phone ?? "", branch: b, group: s.enrollments[0]?.group.name ?? null, debt: d });
  }
  rows.sort((a, b) => b.debt - a.debt);
  const limit = Math.min(Math.max(Number(i.limit) || 10, 1), 50);
  return {
    branch: br?.name ?? "Barcha filiallar",
    totalDebtors: rows.length, totalDebt: rows.reduce((a, r) => a + r.debt, 0),
    perBranch, top: rows.slice(0, limit), currency: "so'm",
  };
}

async function studentsSummary(i: { from?: string; to?: string; branch?: string }) {
  const r = range(i.from, i.to);
  const br = await resolveBranch(i.branch);
  if (br === "notfound") return { error: `"${i.branch}" filiali topilmadi` };
  const bw = br ? { branchId: br.id } : {};
  const [byStatus, groups, newStudents] = await Promise.all([
    prisma.student.groupBy({ by: ["eduStatus"], where: bw, _count: { _all: true } }),
    prisma.group.count({ where: { ...bw, status: { notIn: ["CANCELLED", "FINISHED", "ARCHIVED"] } } }),
    prisma.groupStudent.count({ where: { joinedAt: { gte: r.start, lt: r.end }, ...(br ? { group: { branchId: br.id } } : {}) } }),
  ]);
  return {
    branch: br?.name ?? "Barcha filiallar",
    byStatus: Object.fromEntries(byStatus.map((s) => [s.eduStatus, s._count._all])),
    activeGroups: groups, newEnrollmentsInPeriod: newStudents, period: r.label,
  };
}

async function findStaff(i: { query?: string; role?: string }) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: i.role ? i.role : { notIn: ["STUDENT", "PARENT"] },
      ...(i.query?.trim() ? { fullName: { contains: i.query.trim() } } : {}),
    },
    select: { id: true, fullName: true, role: true, position: true, lastLoginAt: true, branch: { select: { name: true } } },
    orderBy: { fullName: "asc" },
    take: 40,
  });
  return users.map((u) => ({
    id: u.id, name: u.fullName, role: L(ROLE_LABELS as never, u.role) || u.role, position: u.position,
    branch: u.branch?.name ?? null, lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  }));
}

async function staffActivity(i: { userId: string; from?: string; to?: string }) {
  const r = range(i.from, i.to);
  const u = await prisma.user.findUnique({ where: { id: i.userId }, select: { id: true, fullName: true, role: true, lastLoginAt: true } });
  if (!u) return { error: "Xodim topilmadi" };
  const when = { gte: r.start, lt: r.end };
  const [audit, recent, leadActs, calls, payments, tasksOpen, tasksDone, leadsAssigned] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action", "entityType"], where: { actorId: u.id, createdAt: when }, _count: { _all: true } }),
    prisma.auditLog.findMany({ where: { actorId: u.id, createdAt: when }, orderBy: { createdAt: "desc" }, take: 15, select: { action: true, entityType: true, reason: true, createdAt: true } }),
    prisma.leadActivity.groupBy({ by: ["type"], where: { authorId: u.id, createdAt: when }, _count: { _all: true } }),
    prisma.call.findMany({ where: { operatorId: u.id, startedAt: when }, select: { status: true, direction: true, duration: true } }),
    prisma.payment.aggregate({ where: { authorId: u.id, status: "PAID", createdAt: when }, _sum: { amount: true }, _count: true }),
    prisma.task.count({ where: { assigneeId: u.id, status: "OPEN" } }),
    prisma.task.count({ where: { assigneeId: u.id, status: "DONE", doneAt: when } }),
    prisma.lead.count({ where: { managerId: u.id, createdAt: when } }),
  ]);
  return {
    staff: u.fullName, role: L(ROLE_LABELS as never, u.role) || u.role, period: r.label,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    actions: audit.map((a) => ({ action: a.action, entity: a.entityType, count: a._count._all })),
    recentActions: recent.map((a) => ({ at: a.createdAt.toISOString(), action: a.action, entity: a.entityType, reason: a.reason })),
    leadWork: Object.fromEntries(leadActs.map((a) => [a.type, a._count._all])), newLeadsAssigned: leadsAssigned,
    calls: {
      total: calls.length,
      answered: calls.filter((c) => c.status === "ANSWERED").length,
      missed: calls.filter((c) => c.status !== "ANSWERED").length,
      outgoing: calls.filter((c) => c.direction === "OUTGOING").length,
      talkMinutes: Math.round(calls.reduce((a, c) => a + c.duration, 0) / 60),
    },
    paymentsAccepted: { count: payments._count, sum: payments._sum.amount ?? 0 },
    tasks: { open: tasksOpen, doneInPeriod: tasksDone },
  };
}

async function listTasks(i: { assigneeId?: string; status?: string }) {
  const tasks = await prisma.task.findMany({
    where: { kind: "TASK", ...(i.assigneeId ? { assigneeId: i.assigneeId } : {}), ...(i.status ? { status: i.status } : {}) },
    orderBy: { createdAt: "desc" }, take: 30,
    select: { title: true, status: true, priority: true, dueAt: true, createdAt: true, assignee: { select: { fullName: true } }, author: { select: { fullName: true } } },
  });
  return tasks.map((t) => ({ title: t.title, status: t.status, priority: t.priority, dueAt: t.dueAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString(), assignee: t.assignee?.fullName ?? null, author: t.author?.fullName ?? null }));
}

const taskInput = z.object({
  assigneeId: z.string().min(1),
  title: z.string().trim().min(2).max(300),
  note: z.string().max(2000).optional(),
  dueAt: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
});

async function createTask(raw: unknown, actor: AiActor, branchId: string | null) {
  const p = taskInput.safeParse(raw);
  if (!p.success) return { error: "Topshiriq ma'lumotlari noto'g'ri" };
  const assignee = await prisma.user.findUnique({ where: { id: p.data.assigneeId }, select: { id: true, fullName: true, isActive: true, role: true } });
  if (!assignee || !assignee.isActive || ["STUDENT", "PARENT"].includes(assignee.role)) return { error: "Faol xodim topilmadi" };
  let dueAt: Date | null = null;
  if (p.data.dueAt) {
    const d = new Date(p.data.dueAt.length === 10 ? `${p.data.dueAt}T18:00:00` : p.data.dueAt);
    if (!isNaN(d.getTime())) dueAt = d;
  }
  const task = await prisma.task.create({
    data: {
      kind: "TASK", title: p.data.title, note: p.data.note || null, priority: p.data.priority ?? "NORMAL",
      assigneeId: assignee.id, authorId: actor.userId, dueAt, branchId,
    },
  });
  if (assignee.id !== actor.userId) {
    await notify({ userId: assignee.id, title: { uz: "Yangi topshiriq", ru: "Новая задача", en: "New task", de: "Neue Aufgabe" }, body: task.title, event: "task" });
  }
  await writeAudit({ actorId: actor.userId, action: "CREATE", entityType: "Task", entityId: task.id, newValue: { title: task.title, assignee: assignee.fullName, via: "AI" } });
  return { ok: true, taskId: task.id, assignee: assignee.fullName, title: task.title, dueAt: dueAt?.toISOString() ?? null };
}

export async function runAiTool(name: string, input: unknown, actor: AiActor, branchId: string | null): Promise<{ text: string; isError: boolean; wrote?: boolean }> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, never>;
  try {
    let out: unknown;
    switch (name) {
      case "list_branches": out = await listBranches(); break;
      case "finance_summary": out = await financeSummary(i); break;
      case "leads_summary": out = await leadsSummary(i); break;
      case "debtors_summary": out = await debtorsSummary(i); break;
      case "students_summary": out = await studentsSummary(i); break;
      case "find_staff": out = await findStaff(i); break;
      case "staff_activity": {
        const uid = (input as { userId?: unknown })?.userId;
        if (typeof uid !== "string" || !uid) return { text: "userId kerak", isError: true };
        out = await staffActivity({ ...i, userId: uid });
        break;
      }
      case "list_tasks": out = await listTasks(i); break;
      case "create_task": {
        const r = await createTask(input, actor, branchId);
        return { text: JSON.stringify(r), isError: "error" in r, wrote: "ok" in r };
      }
      default: return { text: `Noma'lum vosita: ${name}`, isError: true };
    }
    const text = JSON.stringify(out);
    return { text: text.length > 30_000 ? text.slice(0, 30_000) + "…(qisqartirildi)" : text, isError: false };
  } catch (e) {
    console.error("[ai-tool]", name, e);
    return { text: "Ma'lumotni olishda xatolik yuz berdi", isError: true };
  }
}
