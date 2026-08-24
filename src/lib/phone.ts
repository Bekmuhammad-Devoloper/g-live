// O'zbekiston telefon raqamlari bilan ishlash.
//
// MUHIM (2026-08-24 tuzatish): mamlakat kodini "998 bilan boshlansa" degan
// shart bilan olib tashlash MUMKIN EMAS — "99 888 99 99" kabi haqiqiy
// raqamlarning o'zi 998 bilan boshlanadi. Foydalanuvchi "99" dan keyin "8"
// bosishi bilan maydon tozalanib qolardi. Shuning uchun mamlakat kodi faqat
// to'liq uzunlikda (12 xona) olib tashlanadi.

/** Mahalliy raqam uzunligi (operator kodi + 7 xona), masalan 99 888 99 99 */
export const UZ_LOCAL_LEN = 9;
/** Mamlakat kodi bilan to'liq uzunlik: 998 + 9 xona */
export const UZ_FULL_LEN = 12;

/**
 * Kiritish maskasi: "+998" doimiy prefiks sifatida alohida ko'rsatiladi,
 * foydalanuvchi esa 9 xonani kiritadi → "99 888 99 99".
 * To'liq raqam nusxa tashlansa (+998...), mamlakat kodi olib tashlanadi.
 */
export function fmtUzPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length >= UZ_FULL_LEN && d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, UZ_LOCAL_LEN);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}
