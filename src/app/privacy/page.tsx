import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://germaniya.live"),
  title: "Maxfiylik siyosati — Germaniya Live",
  description: "Germaniya Live ilovasi va sayti qanday ma'lumotlarni yig'adi, nima uchun ishlatadi va qanday himoya qiladi.",
  robots: { index: true, follow: true },
};

const UPDATED = "28.11.2026";
const EMAIL = "yuksalishdev@gmail.com";

type Section = { id?: string; title: string; body: (string | string[])[] };

const UZ: Section[] = [
  {
    title: "1. Kim uchun va nima haqida",
    body: [
      "Ushbu siyosat Germaniya Live nemis tili o'quv markazining o'quvchi ilovasi (Android) va germaniya.live sayti uchun amal qiladi. Ilova o'quv markazida tahsil oladigan o'quvchilar uchun mo'ljallangan: darslar, uy vazifalari, lug'at, o'yinlar, natijalar va ustoz bilan yozishma.",
      "Hisob (login va parol) o'quv markazi tomonidan beriladi. Ilovaning o'zida yangi hisob ochilmaydi.",
    ],
  },
  {
    title: "2. Qanday ma'lumotlarni yig'amiz",
    body: [
      [
        "Hisob ma'lumotlari: ism-familiya, telefon raqami, login, parol (faqat shifrlangan ko'rinishda saqlanadi).",
        "Profil rasmi — faqat o'zingiz yuklasangiz.",
        "O'quv ma'lumotlari: davomat, uy vazifalari va siz yuklagan fayllar, test va imtihon natijalari, ko'rilgan darslar, o'yin natijalari, to'plangan ballar.",
        "Ustozga yozgan xabarlaringiz.",
        "Talaffuz mashqidagi ovoz yozuvi: so'zni to'g'ri aytganingizni tekshirish uchun yuboriladi va tekshiruvdan keyin saqlanmaydi.",
        "Ariza formasi (kursga yozilish): ism va telefon raqami.",
        "Texnik ma'lumotlar: ilova versiyasi va server jurnallari (IP manzil, so'rov vaqti) — xavfsizlik va nosozliklarni tuzatish uchun.",
      ],
      "Biz joylashuv, kontaktlar, SMS yoki qurilmadagi boshqa fayllarga kirmaymiz. Reklama va kuzatuv (analitika) xizmatlari ishlatilmaydi.",
    ],
  },
  {
    title: "3. Ruxsatlar",
    body: [
      [
        "Mikrofon — faqat talaffuz mashqini o'zingiz boshlaganingizda.",
        "Internet — darslar va ma'lumotlar germaniya.live serveridan yuklanadi.",
      ],
    ],
  },
  {
    title: "4. Ma'lumotlardan foydalanish",
    body: [
      "Ma'lumotlar faqat o'quv jarayonini tashkil qilish uchun ishlatiladi: darslarni ko'rsatish, natija va davomatni yuritish, ustoz bilan aloqa, o'quvchi va ota-onaga xabar berish. Ma'lumotlar sotilmaydi va reklama uchun ishlatilmaydi.",
    ],
  },
  {
    title: "5. Uchinchi tomonlar",
    body: [
      "Talaffuzni tekshirish uchun ovoz yozuvi Google Gemini xizmatiga yuboriladi (yoki Android qurilmasining o'z nutqni tanish xizmati ishlatiladi). Bu xizmat ma'lumotni faqat bizning topshirig'imiz bilan qayta ishlaydi. Boshqa hech kimga ma'lumot berilmaydi, qonunda talab qilingan holatlar bundan mustasno.",
    ],
  },
  {
    title: "6. Saqlash va himoya",
    body: [
      "Ma'lumotlar germaniya.live serverlarida saqlanadi. Barcha ulanishlar HTTPS orqali shifrlanadi, parollar xeshlangan holda saqlanadi, ma'lumotlarga faqat vakolatli xodimlar (o'qituvchi, administrator) o'z vazifasi doirasida kira oladi.",
      "Ma'lumotlar o'qish davomida va o'quv markazining hisob-kitob talablari uchun zarur muddat saqlanadi.",
    ],
  },
  {
    id: "delete",
    title: "7. Germaniya Live hisobini va ma'lumotlarni o'chirish",
    body: [
      "Germaniya Live ilovasidagi hisobingizni va unga bog'liq ma'lumotlarni o'chirish uchun:",
      [
        `${EMAIL} manziliga «Hisobni o'chirish» mavzusida xat yozing yoki o'quv markazi administratoriga murojaat qiling.`,
        "Xatda ism-familiyangiz, ilovadagi loginingiz va telefon raqamingizni ko'rsating.",
        "Biz hisobingizdagi telefon raqami orqali so'rov sizdan ekanini tasdiqlaymiz.",
        "So'rov 30 kun ichida bajariladi va sizga javob yuboriladi.",
      ],
      "O'chiriladi: hisob (login va parol), profil rasmi, uy vazifalari va yuklangan fayllar, ustozga yozilgan xabarlar, o'yin va test natijalari, ballar.",
      "Saqlanadi: to'lov yozuvlari — buxgalteriya hisobi uchun qonunda belgilangan muddat davomida, keyin o'chiriladi.",
    ],
  },
  {
    title: "8. Bolalar",
    body: [
      "Ilova 13 yoshdan katta o'quvchilar uchun mo'ljallangan. 18 yoshgacha bo'lgan o'quvchilarning hisobi ota-ona yoki vasiy roziligi bilan o'quv markazida ochiladi.",
    ],
  },
  {
    title: "9. O'zgarishlar va aloqa",
    body: [`Siyosat o'zgarsa, ushbu sahifa yangilanadi. Savollar bo'yicha: ${EMAIL}.`],
  },
];

const EN: Section[] = [
  {
    title: "1. Scope",
    body: [
      "This policy applies to the Germaniya Live student app (Android) and the germaniya.live website of the Germaniya Live German language learning center. The app is intended for students of the center: lessons, homework, dictionary, games, results and messaging with teachers.",
      "Accounts (login and password) are issued by the learning center. New accounts cannot be created inside the app.",
    ],
  },
  {
    title: "2. Data we collect",
    body: [
      [
        "Account data: full name, phone number, login, password (stored only as a hash).",
        "Profile photo — only if you upload one.",
        "Learning data: attendance, homework and files you upload, test and exam results, lessons viewed, game results, points.",
        "Messages you send to your teacher.",
        "Voice recordings in pronunciation exercises: sent only to check the word you said and not stored afterwards.",
        "Application form (course sign-up): name and phone number.",
        "Technical data: app version and server logs (IP address, request time) for security and troubleshooting.",
      ],
      "We do not access your location, contacts, SMS or other files on your device. No advertising or tracking (analytics) services are used.",
    ],
  },
  {
    title: "3. Permissions",
    body: [
      [
        "Microphone — only when you start a pronunciation exercise.",
        "Internet — lessons and data are loaded from the germaniya.live server.",
      ],
    ],
  },
  {
    title: "4. How we use data",
    body: [
      "Data is used only to run the learning process: showing lessons, keeping results and attendance, teacher communication and notifications to students and parents. Data is never sold or used for advertising.",
    ],
  },
  {
    title: "5. Third parties",
    body: [
      "To check pronunciation, the voice recording is sent to Google Gemini (or the Android device's own speech recognition service is used), which processes it only on our behalf. Data is not shared with anyone else except where required by law.",
    ],
  },
  {
    title: "6. Storage and security",
    body: [
      "Data is stored on germaniya.live servers. All connections are encrypted with HTTPS, passwords are hashed, and only authorized staff (teachers, administrators) can access data within their duties.",
      "Data is kept while you study and for the period required for the center's accounting obligations.",
    ],
  },
  {
    id: "delete-en",
    title: "7. Deleting your Germaniya Live account and data",
    body: [
      "To delete your Germaniya Live app account and related data:",
      [
        `Email ${EMAIL} with the subject "Delete my account", or contact the learning center administrator.`,
        "Include your full name, your app login and your phone number.",
        "We confirm the request with you via the phone number on your account.",
        "The request is completed within 30 days and you receive a reply.",
      ],
      "Deleted: account (login and password), profile photo, homework and uploaded files, messages to teachers, game and test results, points.",
      "Retained: payment records, kept for the period required by accounting law and then deleted.",
    ],
  },
  {
    title: "8. Children",
    body: [
      "The app is intended for students aged 13 and older. Accounts of students under 18 are created at the learning center with the consent of a parent or guardian.",
    ],
  },
  {
    title: "9. Changes and contact",
    body: [`If this policy changes, this page will be updated. Questions: ${EMAIL}.`],
  },
];

function Block({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-7">
      {sections.map((s) => (
        <section key={s.title} id={s.id} className="scroll-mt-6">
          <h2 className="text-[17px] font-bold text-slate-900">{s.title}</h2>
          <div className="mt-2 space-y-2.5 text-[15px] leading-relaxed text-slate-600">
            {s.body.map((b, i) =>
              Array.isArray(b) ? (
                <ul key={i} className="list-disc space-y-1.5 pl-5">
                  {b.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{b}</p>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 sm:py-14">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/app" className="text-sm font-semibold text-[#0e7490] hover:underline">
          Germaniya Live
        </Link>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Maxfiylik siyosati</h1>
        <p className="mt-1 text-sm text-slate-400">Oxirgi yangilanish: {UPDATED}</p>
        <div className="mt-8">
          <Block sections={UZ} />
        </div>

        <hr className="my-12 border-slate-200" />

        <h1 id="en" className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Privacy Policy</h1>
        <p className="mt-1 text-sm text-slate-400">Last updated: 28 November 2026</p>
        <div className="mt-8">
          <Block sections={EN} />
        </div>
      </article>
    </main>
  );
}
