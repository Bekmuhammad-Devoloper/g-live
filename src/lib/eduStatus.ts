import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { branchWhere } from "./branchScope";

const inActiveGroup = (branch: { branchId?: string } = {}): Prisma.GroupStudentWhereInput => ({
  isActive: true,
  group: { status: "ACTIVE", ...branch },
});

export function activeStudentWhere(s: { branchId: string | null }): Prisma.StudentWhereInput {
  return { eduStatus: "ACTIVE", enrollments: { some: inActiveGroup(branchWhere(s)) } };
}

export async function syncEduStatuses(): Promise<{ deactivated: number; activated: number }> {
  const [deactivated, activated] = await prisma.$transaction([
    prisma.student.updateMany({
      where: { eduStatus: "ACTIVE", enrollments: { none: inActiveGroup() } },
      data: { eduStatus: "WAITING" },
    }),
    prisma.student.updateMany({
      where: { eduStatus: "WAITING", enrollments: { some: inActiveGroup() } },
      data: { eduStatus: "ACTIVE" },
    }),
  ]);
  return { deactivated: deactivated.count, activated: activated.count };
}
