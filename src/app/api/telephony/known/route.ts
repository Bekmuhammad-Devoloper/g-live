import { last9, leadIdsByPhone, studentExistsByPhone } from "@/lib/phoneLookup";

const text = (s: string) => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const digits = last9(new URL(req.url).searchParams.get("phone") ?? "");
  if (!digits) return text("0");
  const [leads, student] = await Promise.all([leadIdsByPhone(digits, 1), studentExistsByPhone(digits)]);
  return text(leads.length > 0 || student ? "1" : "0");
}
