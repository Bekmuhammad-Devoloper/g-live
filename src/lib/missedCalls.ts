import type { Prisma } from "@prisma/client";

export const MISSED_CALL_WHERE: Prisma.CallWhereInput = {
  OR: [{ status: "MISSED" }, { direction: "INCOMING", status: { in: ["NO_ANSWER", "BUSY"] } }],
};

export const MISSED_PENDING_WHERE: Prisma.CallWhereInput = {
  AND: [MISSED_CALL_WHERE, { callbackStatus: "PENDING" }],
};
