import { logout } from "../(app)/actions";
import { CARD, FlagAvatar } from "./_ui";

// STUDENT rolidagi foydalanuvchida Student yozuvi topilmasa ko'rsatiladi.
// MUHIM: redirect("/dashboard") ISHLATILMAYDI — dashboard STUDENT rolini
// yana /student ga qaytaradi va brauzer ERR_TOO_MANY_REDIRECTS bilan
// yopilib qoladi (o'quvchi o'chirilgan, sessiya esa 7 kunlik JWT bo'lgani
// uchun tirik qolgan holat). O'rniga tushunarli xabar + chiqish tugmasi.

export default function MissingStudent() {
  return (
    <div className={`${CARD} mt-10 flex flex-col items-center gap-4 px-6 py-12 text-center`}>
      <FlagAvatar s={56} id="glMissingAvatar" />
      <div className="text-[18px] font-extrabold text-slate-900">Hisob bog&apos;lanmagan</div>
      <p className="text-[13.5px] leading-relaxed text-slate-600">
        Sizning hisobingizga o&apos;quvchi profili biriktirilmagan yoki u o&apos;chirilgan.
        Administratorga murojaat qiling.
      </p>
      <form action={logout} className="w-full">
        <button
          type="submit"
          className="w-full rounded-2xl bg-[#0e7490] py-3 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)] transition active:scale-[.99]"
        >
          Abmelden
        </button>
      </form>
    </div>
  );
}
