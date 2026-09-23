import { prisma } from "@/lib/db";

// Aqlli taqsimot — Asterisk (eski, 2277 trunki) dialplan CURL bu yerga murojaat qiladi:
//   ${CURL(http://127.0.0.1:3010/api/telephony/known?phone=${CALLERID(num)})}
// Javob (oddiy matn): "1" — raqam GL EDU'da bor (lid yoki o'quvchi), "0" — yo'q.
// Dialplan: GL EDU'da bor va eski CRM'da yo'q → GL EDU operatorlariga; aks holda DID qoidasi.
// Eslatma: JWT yo'q — faqat loopback/tunnel (127.0.0.1) orqali ochiq bo'lishi kerak.
const text = (s: string) => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  const digits = phone.replace(/\D/g, "").slice(-9);
  if (digits.length < 7) return text("0");

  const [lead, student] = await Promise.all([
    prisma.lead.findFirst({ where: { phone: { contains: digits } }, select: { id: true } }),
    prisma.student.findFirst({ where: { OR: [{ phone: { contains: digits } }, { phone2: { contains: digits } }] }, select: { id: true } }),
  ]);
  return text(lead || student ? "1" : "0");
}
