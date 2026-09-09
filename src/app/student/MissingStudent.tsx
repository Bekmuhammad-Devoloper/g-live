import { getSession } from "@/lib/auth";
import { logout } from "../(app)/actions";
import { S } from "./_i18n";
import { CARD, FlagAvatar } from "./_ui";

// STUDENT rolidagi foydalanuvchida Student yozuvi topilmasa ko'rsatiladi.
// MUHIM: redirect("/dashboard") ISHLATILMAYDI — dashboard STUDENT rolini
// yana /student ga qaytaradi va brauzer ERR_TOO_MANY_REDIRECTS bilan
// yopilib qoladi (o'quvchi o'chirilgan, sessiya esa 7 kunlik JWT bo'lgani
// uchun tirik qolgan holat). O'rniga tushunarli xabar + chiqish tugmasi.
// Matn foydalanuvchi tilida — sessiya bor (aks holda layout /login ga yuborardi).

export default async function MissingStudent() {
  const session = await getSession();
  const t = S(session?.locale ?? "uz");

  return (
    <div className={`${CARD} mt-10 flex flex-col items-center gap-4 px-6 py-12 text-center`}>
      <FlagAvatar s={56} id="glMissingAvatar" />
      <div className="text-[18px] font-extrabold text-slate-900">{t.accountNotLinked}</div>
      <p className="text-[13.5px] leading-relaxed text-slate-600">{t.accountNotLinkedBody}</p>
      <form action={logout} className="w-full">
        <button
          type="submit"
          className="w-full rounded-2xl bg-[#0e7490] py-3 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)] transition active:scale-[.99]"
        >
          {t.logout}
        </button>
      </form>
    </div>
  );
}
