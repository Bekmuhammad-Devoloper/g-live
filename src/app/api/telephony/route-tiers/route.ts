import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { normalizeExtension } from "@/lib/asterisk";

// Kiruvchi qo'ng'iroq taqsimoti uchun bosqichlar — Asterisk dialplan CURL orqali so'raydi:
//   ${CURL(http://127.0.0.1:3010/api/telephony/route-tiers)}
// Javob (oddiy matn): "operatorlar|ROPlar|administratorlar", har biri vergul bilan, masalan
//   "glive5,glive6|glive3,glive4|"
// Faqat faol (isActive) va SIP raqami biriktirilgan xodimlar. Onlayn/band ekanini dialplan
// o'zi DEVICE_STATE bilan tekshiradi.
// Faqat tunnel (loopback, nginx'siz) orqali: X-Real-IP ni faqat nginx qo'yadi (X-Forwarded-For ni Next o'zi ham qo'shadi).
const text = (s: string, status = 200) =>
  new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

const TIERS = [[ROLES.OPERATOR, ROLES.MANAGER], [ROLES.ROP], [ROLES.ADMIN]] as const;

export async function GET(req: Request) {
  if (req.headers.get("x-real-ip")) return text("", 404);

  const users = await prisma.user.findMany({
    where: { isActive: true, sipExtension: { not: null }, role: { in: TIERS.flat() as string[] } },
    select: { role: true, sipExtension: true },
    orderBy: { sipExtension: "asc" },
  });
  const tiers = TIERS.map((roles) => {
    const exts = users
      .filter((u) => (roles as readonly string[]).includes(u.role))
      .map((u) => normalizeExtension(u.sipExtension ?? ""))
      .filter((e): e is string => !!e);
    return [...new Set(exts)].join(",");
  });
  return text(tiers.join("|"));
}
