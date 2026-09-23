import { last9, leadIdsByPhone, studentExistsByPhone } from "@/lib/phoneLookup";

// Aqlli taqsimot — Asterisk (eski, 2277 trunki) dialplan CURL bu yerga murojaat qiladi:
//   ${CURL(http://127.0.0.1:3010/api/telephony/known?phone=${CALLERID(num)})}
// Javob (oddiy matn): "1" — raqam GL EDU'da bor (lid yoki o'quvchi), "0" — yo'q.
// Dialplan: GL EDU'da bor va eski CRM'da yo'q → GL EDU operatorlariga; aks holda DID qoidasi.
// Raqamlar bazada formatlangan ("+998 90 ...") — solishtirish src/lib/phoneLookup.ts orqali.
// Eslatma: JWT yo'q — faqat loopback/tunnel (127.0.0.1) orqali ochiq bo'lishi kerak.
const text = (s: string) => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const digits = last9(new URL(req.url).searchParams.get("phone") ?? "");
  if (!digits) return text("0");
  const [leads, student] = await Promise.all([leadIdsByPhone(digits, 1), studentExistsByPhone(digits)]);
  return text(leads.length > 0 || student ? "1" : "0");
}
