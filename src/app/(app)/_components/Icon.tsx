// SVG ikonka to'plami — Modme/Radian sidebar uslubiga yaqinlashtirilgan
// (yupqa chiziqli, katta o'lchamda chiroyli ko'rinadigan konturli ikonkalar).

import type { JSX } from "react";

const dot = (cx: number, cy: number) => (
  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" fill="currentColor" stroke="none" />
);

const P: Record<string, JSX.Element> = {
  // ── Sidebar (Modme uslubi) ──

  // Lidlar — yuqorisi ochiq quti ichiga tushayotgan strelka
  download: (
    <>
      <path d="M8.8 3.2H5.5A2.3 2.3 0 0 0 3.2 5.5v13a2.3 2.3 0 0 0 2.3 2.3h13a2.3 2.3 0 0 0 2.3-2.3v-13a2.3 2.3 0 0 0-2.3-2.3h-3.3" />
      <path d="M12 5.8v8.4" />
      <path d="m8.3 10.7 3.7 3.7 3.7-3.7" />
    </>
  ),

  // O'qituvchilar — oddiy odam
  teacher: (
    <>
      <circle cx="12" cy="7.5" r="3.4" />
      <path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),

  // Guruhlar — uch qavatli stack
  layers: (
    <>
      <path d="m12 2.5 9.5 4.7-9.5 4.7-9.5-4.7 9.5-4.7Z" />
      <path d="m2.5 12 9.5 4.7 9.5-4.7" />
      <path d="m2.5 16.8 9.5 4.7 9.5-4.7" />
    </>
  ),

  // Talabalar — akademik shapka (mortarboard)
  graduation: (
    <>
      <path d="M12 4 2.8 8 12 12l9.2-4L12 4Z" />
      <path d="M6.6 10.4V15c0 1.5 2.4 2.7 5.4 2.7s5.4-1.2 5.4-2.7v-4.6" />
      <path d="M21.2 8.2v4.4" />
    </>
  ),

  // Eslatmalar — soat (millar 12 va 3 tomon, Modme uslubi)
  clock: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 6.8V12h4" />
    </>
  ),

  // Reyting — kubok
  trophy: (
    <>
      <path d="M7 3.5h10v5.2a5 5 0 0 1-10 0V3.5Z" />
      <path d="M7 5.2H4.6a2.4 2.4 0 0 0 0 4.8H7" />
      <path d="M17 5.2h2.4a2.4 2.4 0 0 1 0 4.8H17" />
      <path d="M12 13.9v3.4" />
      <path d="M8.6 20.5h6.8" />
      <path d="M9.8 17.3h4.4l1.2 3.2H8.6l1.2-3.2Z" />
    </>
  ),

  // Davomat hisobotlari — nuqtali kalendar
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.2" />
      <path d="M3 9.6h18" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
      {dot(7.7, 13)}{dot(12, 13)}{dot(16.3, 13)}
      {dot(7.7, 17.2)}{dot(12, 17.2)}
    </>
  ),

  // Topshiriqlar — belgilangan ro'yxat
  clipboard: (
    <>
      <rect x="8.2" y="2.2" width="7.6" height="3.8" rx="1.2" />
      <path d="M15.8 4.1H18a2 2 0 0 1 2 2v13.7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.1a2 2 0 0 1 2-2h2.2" />
      <path d="m7.6 11.4 1.3 1.3 2.2-2.2" />
      <path d="m7.6 16.4 1.3 1.3 2.2-2.2" />
      <path d="M13.6 11.6h3.2" />
      <path d="M13.6 16.6h3.2" />
    </>
  ),

  // O'quv bo'limi — kitob
  book: (
    <>
      <path d="M4 5.3A2.3 2.3 0 0 1 6.3 3H20v15.4H6.3A2.3 2.3 0 0 0 4 20.7V5.3Z" />
      <path d="M4 18.4A2.3 2.3 0 0 1 6.3 21H20" />
      <path d="M8.5 7.8h7" />
      <path d="M8.5 11.4h4.5" />
    </>
  ),

  // Blok test — tekshirilgan hujjat
  filecheck: (
    <>
      <path d="M13.8 2.5H6.8a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2V7.8l-5.4-5.3Z" />
      <path d="M13.6 2.6v5.3h5.4" />
      <path d="m8.6 14.6 2 2 4-4" />
    </>
  ),

  // Moliya — hamyon
  wallet: (
    <>
      <path d="M3.2 7.4a2.2 2.2 0 0 1 2.2-2.2h11.4v2.2" />
      <rect x="3.2" y="7.4" width="17.6" height="11.4" rx="2.2" />
      <path d="M20.8 11.5h-4a2.3 2.3 0 0 0 0 4.6h4" />
      {dot(16.9, 13.8)}
    </>
  ),

  // Nazorat — ko'z
  eye: (
    <>
      <path d="M2.2 12S6 5.4 12 5.4 21.8 12 21.8 12 18 18.6 12 18.6 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),

  // Nazorat — qalqon + belgi
  shieldCheck: (
    <>
      <path d="M12 2.5 4.5 5.3v6.2c0 4.7 3.3 7.6 7.5 9.5 4.2-1.9 7.5-4.8 7.5-9.5V5.3L12 2.5Z" />
      <path d="m8.8 11.8 2.3 2.3 4.1-4.3" />
    </>
  ),

  // Boshqaruv — panel
  layout: (
    <>
      <rect x="3" y="3.2" width="7.4" height="8.6" rx="1.6" />
      <rect x="13.6" y="3.2" width="7.4" height="5.2" rx="1.6" />
      <rect x="13.6" y="12.2" width="7.4" height="8.6" rx="1.6" />
      <rect x="3" y="15.6" width="7.4" height="5.2" rx="1.6" />
    </>
  ),

  // Hisobotlar — diagramma
  chart: (
    <>
      <path d="M3.2 3.2v17.6h17.6" />
      <path d="M7.6 16.4v-3.6" />
      <path d="M12 16.4V8.6" />
      <path d="M16.4 16.4V5.6" />
    </>
  ),

  // Sotuv / Marketing — karnay
  megaphone: (
    <>
      <path d="M3.2 10.4v3.2a1.6 1.6 0 0 0 1.2 1.55l3.2.8v-7.9l-3.2.8a1.6 1.6 0 0 0-1.2 1.55Z" />
      <path d="m7.6 8.05 11.2-3.6a1 1 0 0 1 1.3.95v13.2a1 1 0 0 1-1.3.95L7.6 15.95" />
      <path d="M9.4 16.7v2.6a1.8 1.8 0 0 0 3.6 0v-1.7" />
    </>
  ),

  // Sozlamalar — shesternya
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 14.3a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.3a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.3a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),

  // ── Umumiy (kichik o'lchamda ishlatiladi) ──
  home: <><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  check: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  award: <><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,

  // ── Navbar ──
  plus: <><circle cx="12" cy="12" r="9.5" /><path d="M12 8v8" /><path d="M8 12h8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  building: <>
    <path d="M3 21h18" />
    <path d="M5 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
    <path d="M14 10h4a1 1 0 0 1 1 1v10" />
    <path d="M8 8.5h3" /><path d="M8 12h3" /><path d="M8 15.5h3" />
  </>,
  expand: <>
    <path d="M8 3H4.8A1.8 1.8 0 0 0 3 4.8V8" />
    <path d="M16 3h3.2A1.8 1.8 0 0 1 21 4.8V8" />
    <path d="M16 21h3.2a1.8 1.8 0 0 0 1.8-1.8V16" />
    <path d="M8 21H4.8A1.8 1.8 0 0 1 3 19.2V16" />
    <path d="m4 4 5 5" /><path d="m20 4-5 5" /><path d="m20 20-5-5" /><path d="m4 20 5-5" />
  </>,
  minimize: <>
    <path d="M9 3v4.2A1.8 1.8 0 0 1 7.2 9H3" />
    <path d="M15 3v4.2A1.8 1.8 0 0 0 16.8 9H21" />
    <path d="M15 21v-4.2a1.8 1.8 0 0 1 1.8-1.8H21" />
    <path d="M9 21v-4.2A1.8 1.8 0 0 0 7.2 15H3" />
  </>,
  backspace: <>
    <path d="M9.5 5.5H20a1.4 1.4 0 0 1 1.4 1.4v10.2A1.4 1.4 0 0 1 20 18.5H9.5L3 12l6.5-6.5Z" />
    <path d="m11.5 9.5 5 5" /><path d="m16.5 9.5-5 5" />
  </>,
  video: <>
    <rect x="2.5" y="6" width="13" height="12" rx="2.2" />
    <path d="m15.5 10.5 5.2-2.9a.6.6 0 0 1 .8.5v7.8a.6.6 0 0 1-.8.5l-5.2-2.9" />
  </>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.3 17.7-1.4 1.4" /><path d="m19.1 4.9-1.4 1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  filter: <path d="M3 4.5h18l-7 8.2V20l-4-2v-5.3L3 4.5Z" />,
  info: <><circle cx="12" cy="12" r="9.3" /><path d="M12 11v5" /><path d="M12 7.6h.01" /></>,
  phone: <path d="M6.6 3.5 4 4c-.7.2-1.1.9-1 1.6C4 12 12 20 18.4 21c.7.1 1.4-.3 1.6-1l.5-2.6a1 1 0 0 0-.6-1.1l-3-1.2a1 1 0 0 0-1.1.3l-1 1.2a13 13 0 0 1-5.4-5.4l1.2-1a1 1 0 0 0 .3-1.1l-1.2-3a1 1 0 0 0-1.1-.6Z" />,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.2" /><path d="m3 6 9 6.5L21 6" /></>,
  pin: <><path d="M20 10.5c0 5.5-8 11-8 11s-8-5.5-8-11a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10.5" r="2.6" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3.5" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 4v5h-5" /></>,
  printer: <><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.4" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4" /></>,
  listView: <><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,

  // ── Dashboard status kartalari ──
  personPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></>,
  personCheck: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></>,
  personStar: <><path d="M14 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="8" cy="7" r="4" /><path d="m18 4 1.1 2.3 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3L18 4Z" /></>,
  personMinus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11h-6" /></>,
  personX: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m17 8 5 5" /><path d="m22 8-5 5" /></>,
  personOff: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m2 2 20 20" /></>,
  fileX: <><path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /><path d="M8 12h4" /><path d="m10 15.5 4 4" /><path d="m14 15.5-4 4" /></>,
  snowflake: <><path d="M12 2v20" /><path d="M2 12h20" /><path d="m20 16-4-4 4-4" /><path d="m4 8 4 4-4 4" /><path d="m16 4-4 4-4-4" /><path d="m8 20 4-4 4 4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>,
  coins: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v5c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8V6" /><path d="M5 11v5c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-5" /></>,

  // ── Valyuta (navbardagi kurs) ──
  dollar: <><path d="M12 2.8v18.4" /><path d="M16.6 6.6H10a3.4 3.4 0 0 0 0 6.8h4a3.4 3.4 0 0 1 0 6.8H6.8" /></>,
  euro: <><path d="M19.6 6.1a7.3 7.3 0 0 0-5-2C10.4 4.1 7 7.6 7 12s3.4 7.9 7.6 7.9a7.3 7.3 0 0 0 5-2" /><path d="M4 10.2h9.4" /><path d="M4 14h7.4" /></>,
  // O'sish / pasayish uchun to'ldirilgan uchburchak
  trendUp: <path d="M12 7.4 18.4 16H5.6L12 7.4Z" fill="currentColor" stroke="none" />,
  trendDown: <path d="M12 16.6 5.6 8h12.8L12 16.6Z" fill="currentColor" stroke="none" />,

  // ── Qo'ng'iroqlar markazi ──
  headphones: <><path d="M3 14a9 9 0 0 1 18 0" /><rect x="3" y="13.5" width="4.5" height="7.5" rx="1.6" /><rect x="16.5" y="13.5" width="4.5" height="7.5" rx="1.6" /></>,
  phoneCall: <><path d="M14.5 3a5.5 5.5 0 0 1 5.5 5.5" /><path d="M14.5 6.5a2 2 0 0 1 2 2" /><path d="M6.6 3.5 4 4c-.7.2-1.1.9-1 1.6C4 12 12 20 18.4 21c.7.1 1.4-.3 1.6-1l.5-2.6a1 1 0 0 0-.6-1.1l-3-1.2a1 1 0 0 0-1.1.3l-1 1.2a13 13 0 0 1-5.4-5.4l1.2-1a1 1 0 0 0 .3-1.1l-1.2-3a1 1 0 0 0-1.1-.6Z" /></>,
  phoneMissed: <><path d="m15.5 3 5 5" /><path d="m20.5 3-5 5" /><path d="M6.6 3.5 4 4c-.7.2-1.1.9-1 1.6C4 12 12 20 18.4 21c.7.1 1.4-.3 1.6-1l.5-2.6a1 1 0 0 0-.6-1.1l-3-1.2a1 1 0 0 0-1.1.3l-1 1.2a13 13 0 0 1-5.4-5.4l1.2-1a1 1 0 0 0 .3-1.1l-1.2-3a1 1 0 0 0-1.1-.6Z" /></>,
  phoneOff: <><path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a1 1 0 0 1 1.1-.3l3 1.2a1 1 0 0 1 .6 1.1L20.9 20a1.4 1.4 0 0 1-1.5 1C13 20 6 13 4.9 6.6" /><path d="M3.1 5.6C3 4.9 3.4 4.2 4 4l2.6-.5a1 1 0 0 1 1.1.6l1.2 3a1 1 0 0 1-.3 1.1l-1.2 1" /><path d="m2 2 20 20" /></>,
  arrowDownLeft: <><path d="M17 7 7 17" /><path d="M16 17H7V8" /></>,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  play: <path d="M7 5.2v13.6l11-6.8-11-6.8Z" />,
  pause: <><path d="M9 5v14" /><path d="M15 5v14" /></>,
  alert: <><circle cx="12" cy="12" r="9.3" /><path d="M12 7.5v5" /><path d="M12 16.2h.01" /></>,
  mic: <><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M18.5 10.5a6.5 6.5 0 0 1-13 0" /><path d="M12 17v3.5" /><path d="M8.5 20.5h7" /></>,
  micOff: <><path d="M9 5.3a3 3 0 0 1 6 0v5.2c0 .4-.05.8-.15 1.2" /><path d="M7 10.5v.3a5 5 0 0 0 8.1 3.9" /><path d="M18.5 10.5a6.5 6.5 0 0 1-1 3.5" /><path d="M12 17v3.5" /><path d="M8.5 20.5h7" /><path d="m3 3 18 18" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  camera: <><path d="M4 8.5a2 2 0 0 1 2-2h1.6l1-1.6h4.8l1 1.6H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z" /><circle cx="12" cy="12.5" r="3.2" /></>,

  // ── Havolalar / platformalar ──
  link: <><path d="M9.5 14.5 14.5 9.5" /><path d="M11 6.2 12.3 4.9a4 4 0 0 1 5.7 5.7l-1.3 1.3" /><path d="M13 17.8 11.7 19.1a4 4 0 0 1-5.7-5.7l1.3-1.3" /></>,
  globe: <><circle cx="12" cy="12" r="9.2" /><path d="M2.8 12h18.4" /><path d="M12 2.8c2.6 2.5 4 5.8 4 9.2s-1.4 6.7-4 9.2c-2.6-2.5-4-5.8-4-9.2s1.4-6.7 4-9.2Z" /></>,
  telegram: <><path d="M21.5 4.3 2.8 11.5c-.9.35-.88 1.65.03 1.97l4.7 1.66 1.8 5.3c.24.7 1.14.86 1.6.28l2.28-2.83 4.6 3.38c.6.44 1.46.11 1.62-.62l3.2-15.1c.18-.86-.66-1.58-1.53-1.42Z" /><path d="m7.5 15.1 9.7-6.6-7.4 7.6" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" />{dot(17.2, 6.8)}</>,

  // ── Matn muharriri ──
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.7" /><path d="m21 15-5-5L5 21" /></>,
  alignLeft: <><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h13" /></>,
  listOrdered: <><path d="M10 6h11" /><path d="M10 12h11" /><path d="M10 18h11" /><path d="M4.5 5.5h1V10" /><path d="M4 14.5h2l-2 2.5h2" /></>,
  eraser: <><path d="m4 16 6-6 6 6-3.5 3.5H7.5L4 16Z" /><path d="M14 10l4-4a1.5 1.5 0 0 1 2 0l2 2a1.5 1.5 0 0 1 0 2l-4 4" /><path d="M21 20H9" /></>,
  uploadCloud: <><path d="M12 13v8" /><path d="m8 17 4-4 4 4" /><path d="M20 16.5A4.5 4.5 0 0 0 17 8.5h-1.3A7 7 0 1 0 4 15" /></>,
};

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth,
  sketch = false,
  style,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
  sketch?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (sketch ? 1.6 : 1.5)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={sketch ? "url(#gl-sketch)" : undefined}>{P[name] ?? P.home}</g>
    </svg>
  );
}

// Qo'lda chizilgan (doodle) ko'rinish uchun global filter — sahifada bir marta chiqariladi.
export function SketchDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <filter id="gl-sketch" x="-25%" y="-25%" width="150%" height="150%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.15" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
