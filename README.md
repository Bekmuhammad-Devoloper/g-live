# Germaniya Live — O'quv markazini boshqarish tizimi (MVP)

TZ (texnik topshiriq) asosida qurilgan yagona boshqaruv tizimi: **CRM + LMS + to'lov + QR-davomat + sertifikatlash + rollar bo'yicha shaxsiy kabinetlar**.

Bu — 1-bosqich (MVP) yadrosi: ishlaydigan haqiqiy web-ilova (baza, login, RBAC, audit).

---

## Texnologiyalar

| Qatlam | Tanlov |
|--------|--------|
| Frontend + Backend | **Next.js 15** (App Router, React 19, Server Actions) |
| Til | TypeScript |
| Stil | Tailwind CSS |
| ORM / Baza | **Prisma** + SQLite (dev) → PostgreSQL (production) |
| Auth | JWT (jose) + httpOnly cookie, `bcryptjs` parol xeshlash |
| i18n | O'zbek / Rus (kengaytiriladigan lug'at) |
| PWA | `manifest.webmanifest` — telefonga ilova kabi o'rnatiladi |

---

## Ishga tushirish

```bash
npm install          # kutubxonalar (agar hali o'rnatilmagan bo'lsa)
npm run db:push      # bazani sxema bo'yicha yaratish
npm run db:seed      # demo ma'lumotlar bilan to'ldirish
npm run dev          # http://localhost:3000
```

Bazani noldan qayta tiklash uchun: `npm run db:reset`

### Demo hisoblar (parol hammasida: `12345678`)

| E-mail | Rol |
|--------|-----|
| `director@gl.uz` | Direktor |
| `deputy@gl.uz` | Direktor o'rinbosari |
| `manager@gl.uz` | Menejer |
| `teacher@gl.uz` | O'qituvchi |
| `student@gl.uz` | O'quvchi |
| `parent@gl.uz` | Ota-ona |
| `admin@gl.uz` | Administrator |

> Login sahifasida demo hisobni bir bosishda tanlash mumkin.

---

## Nima ishlaydi (MVP funksiyalari)

- **Autentifikatsiya** — login/logout, JWT sessiya, parol xeshlash (bcrypt).
- **RBAC (rolga asoslangan kirish)** — TZ 2.3 ruxsatlar matritsasi, **serverning har bir so'rovida** tekshiriladi (nafaqat interfeysda). Har rol faqat o'ziga tegishli bo'limlarni ko'radi.
- **CRM / savdo voronkasi** — lidlar ro'yxati, bosqichlar bo'yicha taqsimot, yangi lid qo'shish, dublikat telefon tekshiruvi, **bosqichni inline o'zgartirish**, **lidni o'quvchiga aylantirish** (konvertatsiya).
- **To'lovlar** — **onlayn to'lov (provayder callback demo, idempotent — bir xil tranzaksiya ID ikki marta hisoblanmaydi)** + **qo'lda to'lov** (faqat Menejer / Dir. o'rinbosari). **O'chirish taqiqlangan**, faqat sabab bilan bekor qilish — hammasi auditda. To'lov muvaffaqiyatli bo'lganda o'quvchi/ota-onaga bildirishnoma.
- **Guruhlar** — guruh yaratish, o'quvchi qo'shish/biriktirish, dars yaratish, guruh detali.
- **QR-davomat** — o'qituvchi **dinamik QR yaratadi** (15 daqiqa amal qiladi), o'quvchi telefonda skanerlab **o'zini belgilaydi**; muddat tugagan QR rad etiladi, biriktirilmagan skanerlash **anomaliya** sifatida belgilanadi; o'qituvchi qo'lda tuzatadi va yakuniy ro'yxatni tasdiqlaydi.
- **Uy vazifa / baholash** — o'qituvchi vazifa yaratadi, o'quvchi topshiradi, o'qituvchi baholaydi; **past bahoga izoh majburiy** (FR-HW-05).
- **Imtihon / sertifikat** — vakolatli xodim (Direktor/Dir. o'rinbosari) **noyob raqam + QR bilan sertifikat beradi**, bekor qiladi; **ochiq tekshiruv sahifasi** (`/verify/[qr]`) — login talab qilmaydi, QR skanerlaganda haqiqiyligini ko'rsatadi.
- **Bildirishnomalar** — ilova ichi bildirishnoma markazi, o'qilmagan sanog'i (🔔 badge), hodisalar bo'yicha avtomatik (to'lov, yangi vazifa, baho, sertifikat).
- **Audit jurnali** — muhim amallar muallif, vaqt, eski/yangi qiymat, sabab bilan yoziladi; interfeysdan o'zgartirib bo'lmaydi (Direktor/Admin).
- **Rollar bo'yicha kabinetlar** — 7 rol uchun alohida bosh sahifa va ko'rsatkichlar.
- **Hisobotlar** — faol o'quvchilar, lidlar, konversiya, tushum, voronka grafigi.
- **Ko'p tillilik** (o'zbek/rus) va **PWA** (telefonga o'rnatiladi).

## Demo stsenariylar (sinab ko'rish)

1. **QR-davomat:** `teacher@gl.uz` bilan kiring → Guruh → guruhni oching → darsni oching → «QR yaratish» → chiqqan havolani boshqa brauzerda `student@gl.uz` bilan oching → «Davomatni tasdiqlash». O'qituvchi sahifasida holat yangilanadi.
2. **Onlayn to'lov + idempotentlik:** `manager@gl.uz` → To'lovlar → «Onlayn to'lov (demo)» → Tranzaksiya ID kiriting (masalan `TEST-1`) → to'lang. Xuddi shu ID bilan yana urinib ko'ring → tizim ikkinchi marta hisoblashni bloklaydi.
3. **Lidni aylantirish:** `manager@gl.uz` → CRM → lid qatorida «O'quvchiga aylantirish».
4. **Sertifikat + tekshiruv:** `deputy@gl.uz` → Sertifikatlar → «Sertifikat berish». So'ng «QR sahifa» havolasini oching (yoki `/verify/demo-cert-qr-0001`) — login talab qilinmaydi.

---

## TZ ↔ amalga oshirish moslik xaritasi

| TZ bo'limi | Bu yerda |
|-----------|----------|
| 2.3 Ruxsatlar matritsasi (RBAC) | `src/lib/rbac.ts` — har modul/rol uchun FULL/OWN/READ/NONE |
| 2.2 Audit tamoyillari | `src/lib/audit.ts` + `AuditLog` modeli + `/audit` sahifa |
| 3. Biznes-jarayon statuslari | `src/lib/constants.ts` (lid va ta'lim statuslari) |
| 4.1 CRM va voronka | `src/app/(app)/crm/*` |
| 4.4 Uy vazifa / baholash (FR-HW-05) | `src/app/(app)/homework/*` |
| 4.4 QR-davomat (FR-HW-06/07/08) | `groups/[id]/lessons/[lessonId]/*`, `checkin/[token]/*` |
| 4.5 Sertifikat + QR-tekshiruv (FR-EXM-04/05/06) | `certificates/*`, ochiq `app/verify/[qr]/*` |
| 4.7 To'lov qoidalari (FR-PAY-01/02/03/04/06) | `src/app/(app)/payments/*` |
| 4.11 Bildirishnomalar | `src/lib/notify.ts` + `notifications/*` |
| 5. Ma'lumotlar modeli | `prisma/schema.prisma` |
| 6. NFR (xavfsizlik, i18n, PWA) | JWT/bcrypt, `src/lib/i18n.ts`, `manifest.ts` |

---

## Loyiha tuzilishi

```
prisma/
  schema.prisma        # ma'lumotlar modeli (TZ 5-bo'lim)
  seed.ts              # demo ma'lumotlar
src/
  lib/
    constants.ts       # rollar, statuslar, yorliqlar (uz/ru), pul formati
    rbac.ts            # ruxsatlar matritsasi (TZ 2.3)
    auth.ts            # sessiya, parol, JWT
    audit.ts           # audit yozuvi
    i18n.ts            # uz/ru lug'atlar
    db.ts              # Prisma klient
    nav.ts             # rolga qarab menyu
  app/
    login/                        # kirish sahifasi + server action
    verify/[qr]/                  # OCHIQ sertifikat tekshiruv sahifasi (login yo'q)
    (app)/                        # himoyalangan zona (layout auth-gate + 🔔 badge)
      dashboard/                  # rolga bog'liq bosh sahifa
      crm/                        # lidlar + inline bosqich + konvertatsiya
      payments/                   # onlayn + qo'lda to'lov + bekor qilish
      groups/[id]/                # guruh detali (o'quvchi/dars qo'shish)
        lessons/[lessonId]/       # dars + QR generatsiya + davomat
      checkin/[token]/            # o'quvchi QR check-in
      homework/[id]/              # vazifa + topshirish + baholash
      certificates/               # sertifikat berish/bekor qilish
      notifications/              # bildirishnoma markazi
      attendance/ reports/ salary/ users/ audit/
```

---

## Production'ga (PostgreSQL) o'tish

1. `prisma/schema.prisma` da: `provider = "postgresql"`.
2. `.env` da `DATABASE_URL` ni Postgres ulanishiga o'zgartiring.
3. `AUTH_SECRET` ni uzun tasodifiy satrga almashtiring.
4. `npm run db:push && npm run build && npm run start`.

> Enum ishlatilmagani uchun SQLite ↔ PostgreSQL ko'chish silliq kechadi.

---

## Keyingi bosqichlar (TZ 7-bo'lim)

MVP (1-bosqich) yadrosi tayyor. Qolganlari:

- **2-bosqich:** ish haqi formulalari (murakkab hisob-kitob), ombor moduli, imtihon topshirish dvigateli (taymer, bo'limlar, Goethe/telc/TestDaF formatlari), marketing atributsiyasi (UTM → tushum), **haqiqiy to'lov provayderi** (Click/Payme/Uzum) va onlayn-kassa/fiskalizatsiya integratsiyasi, Telegram/e-mail/SMS bildirishnoma kanallari.
- **3-bosqich:** AI-yordamchi (Germaniya Live AI), prognozlar, avtomatik tavsiyalar, chuqur end-to-end analitika.

## Windows eslatmasi

Agar `npm run build` `prisma generate` bosqichida **EPERM** xatosi bersa — fonda ishlab turgan `npm run dev` yoki eski server jarayonini to'xtating (u Prisma dvigateli faylini ushlab turadi), so'ng qayta ishga tushiring.

---

_Germaniya Live — MVP demo, 2026._
