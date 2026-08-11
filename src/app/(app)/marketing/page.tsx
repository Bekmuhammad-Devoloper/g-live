import { redirect } from "next/navigation";

// "Sotuv / Marketing" bo'limi konversiya hisobotiga yo'naltiriladi.
export default function MarketingPage() {
  redirect("/reports/conversion");
}
