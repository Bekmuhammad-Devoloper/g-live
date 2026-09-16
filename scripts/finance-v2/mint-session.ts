// Sinov sessiyasi (JWT) — nusxa bazadagi haqiqiy foydalanuvchi uchun. Faqat audit/smoke (prod'ga EMAS).
//   npx tsx scripts/finance-v2/mint-session.ts --db /abs/copy.db --secret <AUTH_SECRET> --role DIRECTOR|TEACHER|MANAGER
import { SignJWT } from "jose";
import { openSqlite } from "@/lib/finance/ops/sqlite";
import { fail, parseArgs, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const role = typeof args.role === "string" ? args.role : "DIRECTOR";
  const secretRaw = typeof args.secret === "string" ? args.secret : fail("--secret kerak");
  const db = openSqlite(resolveDbPath(args));
  try {
    const u = await db.user.findFirst({ where: { role, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, branchId: true, locale: true } });
    if (!u) { console.log(""); return; }
    const jwt = await new SignJWT({ userId: u.id, role, fullName: u.fullName, locale: u.locale ?? "uz", branchId: u.branchId ?? null })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(new TextEncoder().encode(secretRaw));
    console.log(jwt);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => fail(String(e?.stack ?? e)));
