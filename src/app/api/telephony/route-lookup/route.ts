import { prisma } from "@/lib/db";
import { last9, leadIdsByPhone } from "@/lib/phoneLookup";

// Sticky routing — Asterisk dialplan CURL bu yerga murojaat qiladi:
//   ${CURL(http://127.0.0.1:PORT/api/telephony/route-lookup?phone=${CALLERID(num)})}
// Javob: mijozning oxirgi menejeri (operator)ning sipExtension'i (oddiy matn) yoki bo'sh.
// Raqamlar bazada formatlangan ("+998 90 ...") — solishtirish src/lib/phoneLookup.ts orqali
// (ilgari `contains` bo'shliqlar tufayli hech qachon topmasdi).
// Eslatma: dialplan JWT yubora olmaydi — faqat loopback'da ochiq bo'lishi kerak (prod firewall).
const text = (s: string) => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const digits = last9(new URL(req.url).searchParams.get("phone") ?? "");
  if (!digits) return text("");

  const ids = await leadIdsByPhone(digits, 5);
  if (!ids.length) return text("");
  // Eng oxirgi yangilangan, menejeri bor lid
  const lead = await prisma.lead.findFirst({
    where: { id: { in: ids }, managerId: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { manager: { select: { sipExtension: true, isActive: true } } },
  });
  const ext = lead?.manager?.isActive ? lead.manager.sipExtension : null;
  return text(ext || "");
}
