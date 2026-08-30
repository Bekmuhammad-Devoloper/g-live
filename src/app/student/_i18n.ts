import type { Locale } from "@/lib/constants";

// O'quvchi portalining matnlari. Maket nemischa edi, ammo o'quvchi tilni
// almashtirganda butun ilova o'sha tilga o'tishi kerak — shu sabab barcha
// ko'rinadigan matn shu yerda. Kurs materiali (dars nomi, so'zlar) tarjima
// qilinmaydi: u nemis tilining o'zi.

type T = { uz: string; ru: string; en: string; de: string };
const p = (uz: string, ru: string, en: string, de: string): T => ({ uz, ru, en, de });

const DICT = {
  // ── Pastki menyu ──
  navStart: p("Boshi", "Главная", "Start", "Start"),
  navCourses: p("Kurslar", "Курсы", "Courses", "Kurse"),
  navPractice: p("Mashq", "Практика", "Practice", "Üben"),
  navProfile: p("Profil", "Профиль", "Profile", "Profil"),

  // ── Umumiy ──
  back: p("Orqaga", "Назад", "Back", "Zurück"),
  loading: p("Yuklanmoqda…", "Загрузка…", "Loading…", "Wird geladen…"),
  save: p("Saqlash", "Сохранить", "Save", "Speichern"),
  cancel: p("Bekor", "Отмена", "Cancel", "Abbrechen"),
  empty: p("Ma'lumot yo'q", "Нет данных", "No data", "Keine Daten"),
  day: p("kun", "дн.", "days", "Tage"),
  place: p("o'rin", "место", "place", "Platz"),
  coins: p("tanga", "монет", "coins", "Münzen"),

  // ── Start ekrani ──
  hello: p("Salom", "Привет", "Hello", "Hallo"),
  readyToLearn: p("Nemis tilini o'rganishga tayyormisiz?", "Готовы учить немецкий?", "Ready to learn German?", "Bereit, Deutsch zu lernen?"),
  words: p("So'zlar", "Слова", "Words", "Wörter"),
  reading: p("O'qish", "Чтение", "Reading", "Lesen"),
  listening: p("Tinglash", "Аудирование", "Listening", "Hören"),
  speaking: p("Gapirish", "Речь", "Speaking", "Sprechen"),
  yourProgress: p("Sizning natijangiz", "Ваш прогресс", "Your progress", "Dein Fortschritt"),
  streak: p("Seriya", "Серия", "Streak", "Streak"),
  rank: p("Reyting", "Рейтинг", "Rank", "Rang"),
  videosPodcasts: p("Video va podkastlar", "Видео и подкасты", "Videos & podcasts", "Videos & Podcasts"),
  lesson: p("Dars", "Урок", "Lesson", "Lektion"),
  chapter: p("Bo'lim", "Раздел", "Chapter", "Kapitel"),

  // ── Kurslar ──
  courses: p("Kurslar", "Курсы", "Courses", "Kurse"),
  lessons: p("dars", "уроков", "lessons", "Lektionen"),
  current: p("JORIY", "ТЕКУЩИЙ", "CURRENT", "AKTUELL"),
  noLessons: p("Bu daraja uchun hali dars yo'q.", "Для этого уровня уроков пока нет.", "No lessons for this level yet.", "Für dieses Niveau gibt es noch keine Lektionen."),
  teacherAdds: p("Ustoz tez orada qo'shadi.", "Преподаватель скоро добавит.", "The teacher will add them soon.", "Die Lehrkraft fügt sie bald hinzu."),
  vocabulary: p("Lug'at", "Словарь", "Vocabulary", "Vocabulary"),
  exercises: p("Mashqlar", "Упражнения", "Exercises", "Exercises"),
  theory: p("NAZARIYA", "ТЕОРИЯ", "THEORY", "THEORIE"),
  test: p("Test", "Тест", "Test", "Test"),
  watched: p("Ko'rilgan", "Просмотрено", "Watched", "Gesehen"),
  soon: p("tez orada", "скоро", "soon", "bald"),
  noMaterial: p("Bu dars uchun hali material yo'q.", "Для этого урока пока нет материалов.", "No material for this lesson yet.", "Für diese Lektion gibt es noch kein Material."),

  // ── Mashq (Üben) ──
  practice: p("Mashq", "Практика", "Practice", "Üben"),
  yourHomework: p("Uy vazifalaringiz", "Ваши домашние задания", "Your homework", "Deine Hausaufgaben"),
  tasks: p("Vazifalar", "Задания", "Tasks", "Aufgaben"),
  gamesAndBattle: p("Jang va o'yinlar", "Битва и игры", "Battle & games", "Kampf & Spiele"),
  testKnowledge: p("Bilimingizni sinab ko'ring", "Проверьте свои знания", "Test your knowledge", "Teste dein Wissen"),

  // ── Bildirishnomalar ──
  messages: p("Xabarlar", "Сообщения", "Messages", "Mitteilungen"),
  yourMessages: p("Sizga kelgan xabarlar", "Ваши сообщения", "Your messages", "Deine Nachrichten"),
  allRead: p("Hammasi o'qilgan", "Все прочитаны", "All read", "Alles gelesen"),
  unreadCount: p("ta o'qilmagan xabar", "непрочитанных", "unread", "ungelesen"),

  // ── Profil ──
  profile: p("Profil", "Профиль", "Profile", "Profil"),
  yourAccount: p("Hisobingiz", "Ваш аккаунт", "Your account", "Dein Konto"),
  attendance: p("Davomat", "Посещаемость", "Attendance", "Anwesenheit"),
  exams: p("Imtihonlar", "Экзамены", "Exams", "Prüfungen"),
  certificates: p("Sertifikatlar", "Сертификаты", "Certificates", "Zertifikate"),
  payments: p("To'lovlar", "Платежи", "Payments", "Zahlungen"),
  totalPaid: p("JAMI TO'LANGAN", "ВСЕГО ОПЛАЧЕНО", "TOTAL PAID", "GESAMT BEZAHLT"),
  debt: p("Qarz", "Долг", "Debt", "Schuld"),
  passed: p("O'tdi", "Сдал", "Passed", "Bestanden"),
  failed: p("O'tmadi", "Не сдал", "Failed", "Nicht bestanden"),
  waiting: p("Kutilmoqda", "Ожидает", "Waiting", "Wartet"),
  active: p("Faol", "Активный", "Active", "Aktiv"),
  present: p("Keldi", "Был", "Present", "Da"),
  absent: p("Kelmadi", "Не был", "Absent", "Fehlt"),
  sinceDate: p("dan beri", "с", "since", "seit"),

  // ── Sozlamalar ──
  settings: p("Sozlamalar", "Настройки", "Settings", "Einstellungen"),
  accountControl: p("Hisobingiz boshqaruvi", "Управление аккаунтом", "Account management", "Kontoverwaltung"),
  appLanguage: p("Ilova tili", "Язык приложения", "App language", "App-Sprache"),
  interfaceLanguage: p("Interfeys tili", "Язык интерфейса", "Interface language", "Oberflächensprache"),
  savedInstantly: p("Tanlov darhol saqlanadi", "Выбор сохраняется сразу", "Saved instantly", "Wird sofort gespeichert"),
  notifications: p("Bildirishnomalar", "Уведомления", "Notifications", "Benachrichtigungen"),
  security: p("Xavfsizlik", "Безопасность", "Security", "Sicherheit"),
  accountData: p("Hisob ma'lumotlari", "Данные аккаунта", "Account details", "Kontodaten"),
  fullName: p("Ism-familiya", "Имя и фамилия", "Full name", "Name"),
  phone: p("Telefon", "Телефон", "Phone", "Telefon"),
  group: p("Guruh", "Группа", "Group", "Gruppe"),
  level: p("Daraja", "Уровень", "Level", "Niveau"),
  login: p("Login", "Логин", "Login", "Anmeldename"),
  password: p("Parol", "Пароль", "Password", "Passwort"),
  show: p("Ko'rsatish", "Показать", "Show", "Anzeigen"),
  hide: p("Yashirish", "Скрыть", "Hide", "Verbergen"),
  changePassword: p("Parolni o'zgartirish", "Сменить пароль", "Change password", "Passwort ändern"),
  logout: p("Chiqish", "Выход", "Log out", "Abmelden"),
  contactCenter: p("O'zgartirish uchun ma'muriyatga murojaat qiling", "Для изменения обратитесь к администрации", "Contact the centre to change this", "Wenden Sie sich an die Verwaltung"),

  // ── Lug'at ──
  dictionary: p("Lug'at", "Словарь", "Dictionary", "Wörterbuch"),
  myCourse: p("Kursim", "Мой курс", "My course", "Mein Kurs"),
  fullDictionary: p("Umumiy lug'at", "Общий словарь", "Full dictionary", "Gesamtes Wörterbuch"),
  searchWord: p("So'z qidirish…", "Поиск слова…", "Search a word…", "Wort suchen…"),
  searchDeUz: p("Nemischa yoki o'zbekcha so'z…", "Немецкое или узбекское слово…", "German or Uzbek word…", "Deutsches oder usbekisches Wort…"),
  all: p("Barchasi", "Все", "All", "Alle"),
  notFound: p("Topilmadi", "Не найдено", "Not found", "Nicht gefunden"),
  tryAnother: p("Boshqacha yozib ko'ring.", "Попробуйте иначе.", "Try another spelling.", "Versuchen Sie eine andere Schreibweise."),
  showMore: p("Yana ko'rsatish", "Показать ещё", "Show more", "Mehr anzeigen"),
  wordsCount: p("ta so'z", "слов", "words", "Wörter"),
  emptyDict: p("Lug'at hali bo'sh", "Словарь пока пуст", "The dictionary is empty", "Das Wörterbuch ist leer"),
  teacherAddsWords: p("Ustoz darslarga so'z qo'shgach shu yerda chiqadi.", "Появится, когда преподаватель добавит слова.", "Words appear once the teacher adds them.", "Erscheint, sobald die Lehrkraft Wörter hinzufügt."),

  // ── Market ──
  market: p("Market", "Маркет", "Market", "Markt"),
  exchangeCoins: p("Tangangizni sovg'aga almashtiring", "Обменяйте монеты на призы", "Exchange your coins for rewards", "Tausche deine Münzen gegen Preise"),
  balance: p("Balans", "Баланс", "Balance", "Guthaben"),
  earned: p("Yig'ilgan", "Начислено", "Earned", "Verdient"),
  spent: p("Sarflangan", "Потрачено", "Spent", "Ausgegeben"),
  coinRule: p(
    "Har qatnashgan dars +5, har baholangan vazifa +10 tanga.",
    "За каждый посещённый урок +5, за проверенное задание +10 монет.",
    "+5 coins per attended lesson, +10 per graded task.",
    "+5 Münzen pro besuchter Stunde, +10 pro bewerteter Aufgabe.",
  ),
  rewards: p("Sovg'alar", "Призы", "Rewards", "Preise"),
  noRewards: p("Hozircha sovg'a yo'q", "Пока призов нет", "No rewards yet", "Noch keine Preise"),
  centerAddsSoon: p("O'quv markazi tez orada qo'shadi.", "Центр скоро добавит.", "The centre will add them soon.", "Das Zentrum fügt sie bald hinzu."),
  myOrders: p("Buyurtmalarim", "Мои заказы", "My orders", "Meine Bestellungen"),
  take: p("Olish", "Взять", "Get", "Nehmen"),
  needed: p("kerak", "нужно", "needed", "nötig"),
  soldOut: p("Tugagan", "Закончилось", "Sold out", "Ausverkauft"),
  left: p("ta qoldi", "осталось", "left", "übrig"),
  confirm: p("Tasdiqlash", "Подтвердить", "Confirm", "Bestätigen"),
  no: p("Yo'q", "Нет", "No", "Nein"),
  ordered: p("Buyurtma berildi", "Заказ оформлен", "Ordered", "Bestellt"),
  delivered: p("Berildi", "Выдано", "Delivered", "Ausgegeben"),
  cancelled: p("Bekor qilindi", "Отменено", "Cancelled", "Storniert"),

  // ── Ustozga yozish ──
  writeTeacher: p("Ustozga yozish", "Написать преподавателю", "Message the teacher", "Lehrkraft schreiben"),
  yourTeacher: p("Sizning ustozingiz", "Ваш преподаватель", "Your teacher", "Deine Lehrkraft"),
  noTeacher: p("Ustoz biriktirilmagan", "Преподаватель не назначен", "No teacher assigned", "Keine Lehrkraft zugewiesen"),
  askAdmin: p("Ma'muriyatga murojaat qiling", "Обратитесь к администрации", "Contact the centre", "Wenden Sie sich an die Verwaltung"),
  writeQuestion: p("Savolingizni yozing…", "Напишите свой вопрос…", "Write your question…", "Schreiben Sie Ihre Frage…"),
  send: p("Yuborish", "Отправить", "Send", "Senden"),
  sending: p("Yuborilmoqda…", "Отправка…", "Sending…", "Wird gesendet…"),
  sentToTeacher: p("Xabar ustozga yuborildi", "Сообщение отправлено", "Message sent", "Nachricht gesendet"),
  sentMessages: p("Yuborilgan xabarlar", "Отправленные сообщения", "Sent messages", "Gesendete Nachrichten"),

  // ── Vazifalar ro'yxati ──
  skillSpeaking: p("Gapirish", "Речь", "Speaking", "Sprechen"),
  skillWriting: p("Yozish", "Письмо", "Writing", "Schreiben"),
  skillReading: p("O'qish", "Чтение", "Reading", "Lesen"),
  skillListening: p("Tinglash", "Аудирование", "Listening", "Hören"),
  skillGrammar: p("Grammatika", "Грамматика", "Grammar", "Grammatik"),
  overdue: p("Muddati o'tdi", "Срок истёк", "Overdue", "Frist abgelaufen"),
  isNew: p("Yangi", "Новое", "New", "Neu"),
  returned: p("Qaytarildi", "Возвращено", "Returned", "Zurückgegeben"),
  submitted: p("Topshirildi", "Сдано", "Submitted", "Abgegeben"),
  avgGrade: p("O'rtacha baho", "Средний балл", "Avg. grade", "Ø Note"),
  writeAnswerFirst: p("Avval javob yozing", "Сначала напишите ответ", "Write an answer first", "Bitte zuerst eine Antwort schreiben"),
  tryAgain: p("Xatolik — qayta urinib ko'ring", "Ошибка — попробуйте снова", "Error — please try again", "Fehler — bitte erneut versuchen"),
  writeNewAnswer: p("Yangi javob yozing…", "Напишите новый ответ…", "Write a new answer…", "Neue Antwort schreiben…"),
  yourAnswer: p("Javobingiz…", "Ваш ответ…", "Your answer…", "Deine Antwort…"),
  submit: p("Topshirish", "Сдать", "Submit", "Abgeben"),
  noTasks: p("Vazifa yo'q", "Заданий нет", "No tasks", "Keine Aufgaben"),
  noTasksHint: p("Hozircha uy vazifasi yo'q. Dam oling!", "Домашних заданий пока нет. Отдыхайте!", "No homework yet. Take a break!", "Noch keine Hausaufgaben. Erhol dich!"),
  deadline: p("Muddat", "Срок", "Deadline", "Frist"),
  teacher: p("Ustoz", "Преподаватель", "Teacher", "Lehrer"),
  checking: p("Javobingiz tekshirilmoqda…", "Ваш ответ проверяется…", "Your answer is being checked…", "Deine Antwort wird geprüft…"),
  noMessages: p("Xabar yo'q", "Сообщений нет", "No messages", "Keine Mitteilungen"),
  comingSoon: p("Tez orada", "Скоро", "Coming soon", "Bald verfügbar"),

  // ── Start ekrani (qo'shimcha) ──
  discover: p("Ko'rish", "Смотреть", "Discover", "Entdecken"),
  learnWithContent: p("Qiziqarli materiallar bilan nemis tilini o'rganing", "Учите немецкий с интересными материалами", "Learn German with engaging content", "Lerne Deutsch mit spannenden Inhalten"),
  everydayBasics: p("Kundalik hayot asoslari", "Основы повседневной жизни", "Everyday basics", "Grundlagen des Alltags"),
  comingSoonBadge: p("Tez orada", "Скоро", "Coming soon", "Bald verfügbar"),

  // ── Guvohnoma (ID-karta) ──
  birthDate: p("Tug'ilgan sana", "Дата рождения", "Date of birth", "Geburtsdatum"),
  age: p("Yoshi", "Возраст", "Age", "Alter"),
  phone2: p("Qo'shimcha telefon", "Доп. телефон", "Second phone", "Zweites Telefon"),
  photo: p("Rasm", "Фото", "Photo", "Foto"),
  removePhoto: p("O'chirish", "Удалить", "Remove", "Entfernen"),
  editProfile: p("Ma'lumotlarni tahrirlash", "Редактировать данные", "Edit details", "Daten bearbeiten"),
  saved: p("Saqlandi", "Сохранено", "Saved", "Gespeichert"),
  academicNote: p(
    "Guruh va daraja o'quv jarayoni ma'lumoti — ularni ma'muriyat biriktiradi.",
    "Группа и уровень — учебные данные, их назначает администрация.",
    "Group and level are academic data set by the centre.",
    "Gruppe und Niveau werden von der Verwaltung festgelegt.",
  ),
  idCard: p("Guvohnoma", "Удостоверение", "ID card", "Ausweis"),
  buy: p("Sotib olish", "Купить", "Buy", "Kaufen"),
  learnedWords: p("O'zlashtirilgan", "Освоено", "Learned", "Gelernt"),
  learnedWord: p("O'tilgan", "Пройдено", "Learned", "Gelernt"),
  notLearnedYet: p("Hali o'tilmagan", "Ещё не пройдено", "Not learned yet", "Noch nicht gelernt"),
  findInDictionary: p("Lug'atdan qidirish", "Найти в словаре", "Look up in dictionary", "Im Wörterbuch suchen"),
  posVerb: p("fe'l", "глаг.", "verb", "Verb"),
  posAdj: p("sifat", "прил.", "adj.", "Adj."),
  posAdv: p("ravish", "нареч.", "adv.", "Adv."),
  posNum: p("son", "числ.", "num.", "Num."),
  posPron: p("olmosh", "мест.", "pron.", "Pron."),
  posPrep: p("predlog", "предл.", "prep.", "Präp."),
  posConj: p("bog'lovchi", "союз", "conj.", "Konj."),
  posInt: p("undov", "межд.", "interj.", "Interj."),
  chatEmpty: p("Yozishma bo'sh", "Переписка пуста", "No messages yet", "Noch keine Nachrichten"),
  chatEmptyHint: p(
    "Savolingizni yozing — ustoz javob beradi.",
    "Напишите вопрос — преподаватель ответит.",
    "Write your question — the teacher will reply.",
    "Schreiben Sie Ihre Frage — die Lehrkraft antwortet.",
  ),
  today: p("Bugun", "Сегодня", "Today", "Heute"),
  yesterday: p("Kecha", "Вчера", "Yesterday", "Gestern"),
} as const;

export type StudentStrings = { [K in keyof typeof DICT]: string };

export function S(locale: Locale): StudentStrings {
  const out = {} as Record<string, string>;
  for (const [k, v] of Object.entries(DICT)) out[k] = v[locale] ?? v.uz;
  return out as StudentStrings;
}
