import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { Forbidden } from "../../_components/ui";
import HolidaysView from "./HolidaysView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN];

export default async function HolidaysPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title="Kirish taqiqlangan" body="Sozlamalar faqat direktor va administrator uchun." />;
  }
  return <HolidaysView />;
}
