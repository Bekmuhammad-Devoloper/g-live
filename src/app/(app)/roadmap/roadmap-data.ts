// Biznes "Roadmap" — o'zini-o'zi audit (yetuklik) skorkarti.
// Bo'limlar va savollar (Modme "Audit" uslubida). Har savol 0..10 ball.

export type L = { uz: string; ru: string; en: string };
export interface RmQuestion { id: string; text: L; hint?: L }
export interface RmSection { key: string; title: L; hex: string; questions: RmQuestion[] }

const q = (key: string, list: [L, L?][]): RmQuestion[] =>
  list.map(([text, hint], i) => ({ id: `${key}-${i + 1}`, text, hint }));

export const ROADMAP: RmSection[] = [
  {
    key: "mk", title: { uz: "Marketing", ru: "Маркетинг", en: "Marketing" }, hex: "#f59e0b",
    questions: q("mk", [
      [{ uz: "Yillik marketing strategiyasi tuzilgan", ru: "Составлена годовая маркетинговая стратегия", en: "An annual marketing strategy is in place" }],
      [{ uz: "Har kvartallik va oylik marketing rejalari mavjud", ru: "Есть квартальные и месячные маркетинговые планы", en: "Quarterly and monthly marketing plans exist" }],
      [{ uz: "Online marketing foydalaniladi", ru: "Используется онлайн-маркетинг", en: "Online marketing is used" }],
      [{ uz: "Offline marketing foydalaniladi", ru: "Используется офлайн-маркетинг", en: "Offline marketing is used" }],
      [{ uz: "Marketing bo'limida ish jarayoni tizimli yo'lga qo'yilgan", ru: "В отделе маркетинга рабочий процесс системно налажен", en: "The marketing department's workflow is systematically organized" }],
      [{ uz: "Marketing bo'limidagi xodimlar org tuzilmasi bor", ru: "Есть оргструктура сотрудников отдела маркетинга", en: "There is an org structure for marketing staff" }],
      [{ uz: "Marketing bo'limidagi xodimlarning vazifalari aniq qilib yozilgan", ru: "Обязанности сотрудников отдела маркетинга чётко прописаны", en: "The duties of marketing staff are clearly documented" }],
      [{ uz: "Marketing bo'limidagi xodimlarga aniq KPI'lar qo'yilgan", ru: "Для сотрудников отдела маркетинга заданы чёткие KPI", en: "Clear KPIs are set for marketing staff" }],
      [{ uz: "Lidlar qabul qilish avtomatlashgan", ru: "Приём лидов автоматизирован", en: "Lead intake is automated" }],
      [{ uz: "Konversiya o'lchanadi", ru: "Измеряется конверсия", en: "Conversion is measured" }],
      [{ uz: "Ketib qolgan mijozlar bilan ishlash yo'lga qo'yilgan", ru: "Налажена работа с ушедшими клиентами", en: "Working with lost customers is set up" }],
      [{ uz: "Lidlarni boshqarish uchun CRM ishlatilinadi", ru: "Для управления лидами используется CRM", en: "A CRM is used to manage leads" }],
      [{ uz: "Har oylik marketing byudjeti ROI'si o'lchanadi", ru: "Измеряется ROI ежемесячного маркетингового бюджета", en: "The ROI of the monthly marketing budget is measured" }],
      [{ uz: "Marketingga byudjetni oshirib ta'sir ko'rsatsa bo'ladi", ru: "Увеличение бюджета на маркетинг даёт заметный эффект", en: "Increasing the marketing budget produces a measurable effect" }],
      [{ uz: "Media reja mavjud", ru: "Есть медиаплан", en: "A media plan exists" }],
      [{ uz: "Media reja 1 hafta (kamida) oldinda", ru: "Медиаплан готов минимум на 1 неделю вперёд", en: "The media plan is ready at least 1 week ahead" }],
    ]),
  },
  {
    key: "st", title: { uz: "Sotuv", ru: "Продажи", en: "Sales" }, hex: "#22c55e",
    questions: q("st", [
      [{ uz: "Sotuv bo'limi mavjud", ru: "Есть отдел продаж", en: "A sales department exists" }],
      [{ uz: "Sotuv bo'limi ishi administrativ bo'limdan alohida", ru: "Работа отдела продаж отделена от административного отдела", en: "The sales department's work is separate from the administrative one" }],
      [{ uz: "Call Center mavjud", ru: "Есть колл-центр", en: "A call center exists" }],
      [{ uz: "Call center avtomatlashgan", ru: "Колл-центр автоматизирован", en: "The call center is automated" }],
      [{ uz: "Sotuv bo'limini oylik rejalari mavjud", ru: "Есть месячные планы отдела продаж", en: "Monthly sales department plans exist" }],
      [{ uz: "Sotuv bo'limida bonus tizimi / KPI tizimi mavjud", ru: "В отделе продаж есть система бонусов / KPI", en: "The sales department has a bonus / KPI system" }],
      [{ uz: "Voronka CRM orqali nazorat qilinadi", ru: "Воронка контролируется через CRM", en: "The funnel is tracked through the CRM" }],
      [{ uz: "Sotuv skriptlari mavjud", ru: "Есть скрипты продаж", en: "Sales scripts exist" }],
      [{ uz: "Menedjerlarni doimiy ravishda malakasini oshirish tizimi mavjud", ru: "Есть система постоянного повышения квалификации менеджеров", en: "There is a system for continuously upskilling managers" }],
    ]),
  },
  {
    key: "xk", title: { uz: "Xizmat ko'rsatish", ru: "Обслуживание", en: "Service" }, hex: "#ef4444",
    questions: q("xk", [
      [{ uz: "Xizmat ko'rsatish bo'limi alohida shakllangan", ru: "Отдел обслуживания сформирован отдельно", en: "A dedicated service department is established" }],
      [{ uz: "Bo'lim xodimlari vazifalari aniq qilib yozilgan", ru: "Обязанности сотрудников отдела чётко прописаны", en: "The duties of department staff are clearly documented" }],
      [{ uz: "Bo'lim uchun alohida skript qilingan", ru: "Для отдела разработан отдельный скрипт", en: "A separate script has been created for the department" }],
      [{ uz: "CRM orqali boshqariladi", ru: "Управляется через CRM", en: "It is managed through the CRM" }],
      [{ uz: "CJM tizimi yo'lga qo'yilgan", ru: "Налажена система CJM", en: "A CJM system is in place" }],
      [{ uz: "Xodimlarni ishga kelib ketish vaqti nazorat qilinadi", ru: "Контролируется время прихода и ухода сотрудников", en: "Staff arrival and departure times are tracked" }],
      [{ uz: "O'z vazifalari cheklistlari bor", ru: "Есть чек-листы своих задач", en: "There are checklists for their tasks" }],
      [{ uz: "Ish jarayoni avtomatlashgan", ru: "Рабочий процесс автоматизирован", en: "The workflow is automated" }],
      [{ uz: "Ishga kerakli barcha sharoitlar mavjud", ru: "Есть все необходимые для работы условия", en: "All conditions needed for work are provided" }],
      [{ uz: "Oylik rejalar belgilangan", ru: "Заданы месячные планы", en: "Monthly plans are set" }],
      [{ uz: "Bo'limidagi xodimlar org tuzilmasi bor", ru: "Есть оргструктура сотрудников отдела", en: "There is an org structure for department staff" }],
      [{ uz: "Xodimalar uchun mahalliy qonun qoidalar ro'yxatlari mavjud", ru: "Для сотрудников есть перечни внутренних правил", en: "Lists of local rules exist for staff" }],
    ]),
  },
  {
    key: "tl", title: { uz: "Ta'lim", ru: "Обучение", en: "Education" }, hex: "#3b82f6",
    questions: q("tl", [
      [{ uz: "Xodimlarni ishga olish ketma ketligi tasdiqlangan", ru: "Утверждён порядок найма сотрудников", en: "The staff hiring sequence is approved" }],
      [{ uz: "Adaptasion davr uchun ma'lumotlar tayyorlangan", ru: "Подготовлены материалы для адаптационного периода", en: "Materials for the onboarding period are prepared" }],
      [{ uz: "Adaptasion davr uchun ma'sul xodimlar belgilangan", ru: "Назначены ответственные за адаптационный период", en: "Staff responsible for onboarding are assigned" }],
      [{ uz: "Oyliklar oldindan tizimli belgilangan", ru: "Зарплаты заранее системно определены", en: "Salaries are systematically defined in advance" }],
      [{ uz: "O'quv dasturi mavjud", ru: "Есть учебная программа", en: "A curriculum exists" }],
      [{ uz: "O'quv qo'llanmalar tayyorlangan", ru: "Подготовлены учебные пособия", en: "Training manuals are prepared" }],
      [{ uz: "Har dars uchun video, uy vazifasi va topshiriqlar tizimga yuklanadi", ru: "Для каждого урока в систему загружаются видео, домашнее задание и задания", en: "Video, homework and assignments are uploaded to the system for each lesson" }, { uz: "O'qituvchi guruh sahifasidagi \"Dars rejasi\" bo'limida: dars videosini (fayl), uy vazifasi va topshiriqни yuklaydi, har darsni \"o'tildi\" deb belgilaydi", ru: "Преподаватель в разделе «План уроков» на странице группы загружает видео урока (файл), домашнее задание и задание, отмечает каждый урок как пройденный", en: "In the \"Lesson plan\" section on the group page, the teacher uploads the lesson video (file), homework and assignment, and marks each lesson as taught" }],
      [{ uz: "Darslar ketma-ketligi (syllabus) tizimda tuzilgan", ru: "Последовательность уроков (syllabus) составлена в системе", en: "The lesson sequence (syllabus) is set up in the system" }, { uz: "Kurs sahifasidagi \"Darslar\" bo'limida darslar tartib bilan tuziladi", ru: "В разделе «Уроки» на странице курса уроки выстроены по порядку", en: "Lessons are ordered in the \"Lessons\" section on the course page" }],
      [{ uz: "Xodimalar uchun mahalliy qonun qoidalar ro'yxatlari mavjud", ru: "Для сотрудников есть перечни внутренних правил", en: "Lists of local rules exist for staff" }],
      [{ uz: "Xodimlarni rivojlantirish rejasi mavjud", ru: "Есть план развития сотрудников", en: "A staff development plan exists" }],
    ]),
  },
  {
    key: "ml", title: { uz: "Moliya", ru: "Финансы", en: "Finance" }, hex: "#64748b",
    questions: q("ml", [
      [{ uz: "Buxgalter bor", ru: "Есть бухгалтер", en: "There is an accountant" }],
      [{ uz: "Moliyachi yoki shu vazifani bajaradigan inson jamoada bor", ru: "В команде есть финансист или человек, выполняющий эту роль", en: "The team has a financier or someone fulfilling that role" }],
      [{ uz: "PnL jadval yuritiladi", ru: "Ведётся таблица PnL", en: "A PnL table is maintained" }],
      [{ uz: "Cashflow jadval yuritiladi", ru: "Ведётся таблица Cashflow", en: "A cash flow table is maintained" }],
      [{ uz: "Moliyaviy kalendar jadvali yuritiladi", ru: "Ведётся финансовый календарь", en: "A financial calendar is maintained" }],
      [{ uz: "Harajatlar fiksatsiya qilib ketiladi", ru: "Расходы фиксируются", en: "Expenses are recorded" }],
      [{ uz: "Harajatlar optimizatsiyasi ustida ishlanadi", ru: "Ведётся работа над оптимизацией расходов", en: "Work is done on optimizing expenses" }],
      [{ uz: "Jarayonlar avtomatlashgan", ru: "Процессы автоматизированы", en: "Processes are automated" }],
      [{ uz: "Buyudjetlash bajariladi", ru: "Выполняется бюджетирование", en: "Budgeting is carried out" }],
      [{ uz: "KPI tizimi yo'lga qo'yilgan", ru: "Налажена система KPI", en: "A KPI system is in place" }],
    ]),
  },
  {
    key: "ad", title: { uz: "Administrativ", ru: "Административный", en: "Administrative" }, hex: "#f97316",
    questions: q("ad", [
      [{ uz: "Xodimlar qidirilishi va ishga qabul qilinishi avtomatlashgan", ru: "Поиск и наём сотрудников автоматизированы", en: "Recruiting and hiring of staff are automated" }],
      [{ uz: "Xodimlarning ma'suliyatlari yozilgan", ru: "Обязанности сотрудников прописаны", en: "Staff responsibilities are documented" }],
      [{ uz: "Adaptatsion davr uchun barcha materiallar tayyorlangan", ru: "Все материалы для адаптационного периода подготовлены", en: "All onboarding materials are prepared" }],
      [{ uz: "Rejali uchrashuvlar va oylik uchrashuvlar yo'lga qo'yilgan", ru: "Налажены плановые и ежемесячные встречи", en: "Scheduled and monthly meetings are established" }],
      [{ uz: "Har kunlik metrikalar nazorati yo'lga qo'yilgan", ru: "Налажен контроль ежедневных метрик", en: "Daily metrics monitoring is established" }],
      [{ uz: "Barcha jarayonlar CRM da nazorat qilinadi", ru: "Все процессы контролируются в CRM", en: "All processes are tracked in the CRM" }],
      [{ uz: "Vazifalar bajarish trekingi qo'llaniladi", ru: "Используется трекинг выполнения задач", en: "Task-completion tracking is used" }],
      [{ uz: "Direktor lavozimi mavjud, biznes egasi strategiya darajasida aralashadi", ru: "Есть должность директора, владелец участвует на уровне стратегии", en: "A director position exists; the owner is involved at the strategy level" }],
    ]),
  },
];

export const ALL_QUESTIONS = ROADMAP.flatMap((s) => s.questions);
export const MAX_PER_Q = 10;
// Umumiy maksimal ball 60 ga normallashtiriladi (Modme uslubi)
export const TARGET_MAX = 60;
