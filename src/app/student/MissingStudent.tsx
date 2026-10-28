import { getSession } from "@/lib/auth";
import { logout } from "../(app)/actions";
import { S } from "./_i18n";
import { CARD, FlagAvatar } from "./_ui";

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
