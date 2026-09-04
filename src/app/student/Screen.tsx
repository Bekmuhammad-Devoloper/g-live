"use client";

import { usePathname } from "next/navigation";

// Ekran o'tishi — ilovadagidek.
//
// Next sahifani almashtirganda yangi mazmun shunchaki "paydo bo'ladi" va bu
// sayt taassurotini kuchaytiradi. `key` sifatida yo'l berilgani uchun har
// o'tishda blok qaytadan yaratiladi va CSS animatsiyasi (.gl-screen) qayta
// ishga tushadi — natijada ekran yumshoq kirib keladi.
//
// Animatsiya 200ms va oxirida transform QOLMAYDI: ichidagi `fixed` elementlar
// (masalan suzuvchi "+" tugmasi) o'z joyida ishlayveradi.

export default function Screen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="gl-screen">
      {children}
    </div>
  );
}
