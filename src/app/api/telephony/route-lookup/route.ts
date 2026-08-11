import { prisma } from "@/lib/db";

// Sticky routing — Asterisk dialplan CURL bu yerga murojaat qiladi:
//   ${CURL(http://127.0.0.1:PORT/api/telephony/route-lookup?phone=${CALLERID(num)})}
// Javob: mijozning oxirgi menejeri (operator)ning sipExtension'i (oddiy matn) yoki bo'sh.
// Eslatma: dialplan JWT yubora olmaydi — faqat loopback'da ochiq bo'lishi kerak (prod firewall).
const text = (s: string) => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  const digits = phone.replace(/\D/g, "").slice(-9);
  if (digits.length < 7) return text("");

  const lead = await prisma.lead.findFirst({
    where: { phone: { contains: digits } },
    orderBy: { updatedAt: "desc" },
    select: { manager: { select: { sipExtension: true, isActive: true } } },
  });
  const ext = lead?.manager?.isActive ? lead.manager.sipExtension : null;
  return text(ext || "");
}
