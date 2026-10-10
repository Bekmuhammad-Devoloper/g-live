// Markaz logotipi — server va klient komponentlarida birdek ishlatiladi (brand.ts'ni import
// qilmaydi: brend qiymatlari eng yaqin server ota-komponentdan props orqali keladi).
// Logotip yuklanmagan markazda <img> o'rniga markaz nomi matn ko'rinishida chiqadi.

export interface BrandView {
  name: string;
  logo: string;
  logoDark: string;
}

export default function BrandLogo({
  brand,
  className,
  textClassName = "text-xl font-extrabold tracking-tight text-slate-900 dark:text-white",
  variant = "auto",
}: {
  brand: BrandView;
  /** <img> uchun klasslar */
  className: string;
  /** Logotip bo'lmaganda chiqadigan nom uchun klasslar */
  textClassName?: string;
  /** auto — yorug'/qorong'i rejimga qarab almashadi; light/dark — faqat bitta variant */
  variant?: "auto" | "light" | "dark";
}) {
  const dark = brand.logoDark || brand.logo;
  if (!brand.logo && !dark) return <span className={textClassName}>{brand.name}</span>;
  if (variant === "light") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo || dark} alt={brand.name} className={className} />;
  }
  if (variant === "dark") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={dark} alt={brand.name} className={className} />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logo || dark} alt={brand.name} className={`${className} dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark} alt={brand.name} className={`${className} hidden dark:block`} />
    </>
  );
}
