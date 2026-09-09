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
  stars: p("yulduz", "звёзд", "stars", "Sterne"),

  // ── Start ekrani ──
  words: p("So'zlar", "Слова", "Words", "Wörter"),
  reading: p("O'qish", "Чтение", "Reading", "Lesen"),
  listening: p("Tinglash", "Аудирование", "Listening", "Hören"),
  speaking: p("Gapirish", "Речь", "Speaking", "Sprechen"),
  yourProgress: p("Sizning natijangiz", "Ваш прогресс", "Your progress", "Dein Fortschritt"),
  streak: p("Seriya", "Серия", "Streak", "Streak"),
  rank: p("Reyting", "Рейтинг", "Rank", "Rang"),
  starRank: p("Daraja", "Уровень", "Rank", "Stufe"),
  starRankSub: p("Yulduz yig'ib ko'tariladigan pog'onalar", "Ступени, которые открываются за звёзды", "Ranks you climb by collecting stars", "Stufen, die Sie mit Sternen erreichen"),
  nextRank: p("Keyingi pog'ona", "Следующая ступень", "Next rank", "Nächste Stufe"),
  starsToNext: p("yulduz qoldi", "звёзд осталось", "stars to go", "Sterne fehlen"),
  topRank: p("Eng yuqori pog'onadasiz", "Вы на высшей ступени", "You are at the top rank", "Sie sind auf der höchsten Stufe"),
  rankRewardLabel: p("Mukofot", "Награда", "Reward", "Belohnung"),
  rankReached: p("Ochilgan", "Открыто", "Reached", "Erreicht"),
  videosPodcasts: p("Video va podkastlar", "Видео и подкасты", "Videos & podcasts", "Videos & Podcasts"),
  noVideosYet: p("Hali video yo'q", "Видео пока нет", "No videos yet", "Noch keine Videos"),
  lesson: p("Dars", "Урок", "Lesson", "Lektion"),
  chapter: p("Bo'lim", "Раздел", "Chapter", "Kapitel"),

  // ── Kurslar ──
  courses: p("Kurslar", "Курсы", "Courses", "Kurse"),
  lessons: p("dars", "уроков", "lessons", "Lektionen"),
  current: p("JORIY", "ТЕКУЩИЙ", "CURRENT", "AKTUELL"),
  noLessons: p("Bu daraja uchun hali dars yo'q.", "Для этого уровня уроков пока нет.", "No lessons for this level yet.", "Für dieses Niveau gibt es noch keine Lektionen."),
  teacherAdds: p("Ustoz tez orada qo'shadi.", "Преподаватель скоро добавит.", "The teacher will add them soon.", "Die Lehrkraft fügt sie bald hinzu."),

  // ── Darslar yo'li (daraja ichi) ──
  pathDone: p("O'tildi", "Пройден", "Completed", "Abgeschlossen"),
  pathCurrent: p("Joriy dars", "Текущий урок", "Current lesson", "Aktuelle Lektion"),
  pathUpcoming: p("Navbatda", "Далее", "Up next", "Als Nächstes"),
  pathProgress: p("dars o'tildi", "уроков пройдено", "lessons done", "Lektionen geschafft"),
  levelFinish: p("Daraja yakuni", "Конец уровня", "End of level", "Ende des Niveaus"),
  levelFinishHint: p("Barcha darsni o'tsangiz shu yerga yetasiz", "Пройдите все уроки, чтобы дойти сюда", "Finish every lesson to reach this point", "Schließe alle Lektionen ab, um hierher zu gelangen"),
  levelFinished: p("Bu darajani yakunladingiz!", "Вы завершили этот уровень!", "You finished this level!", "Du hast dieses Niveau abgeschlossen!"),
  vocabulary: p("Lug'at", "Словарь", "Vocabulary", "Wortschatz"),
  // Ustoz yuklagan lug'at fayli (pdf/word/txt) — "Lug'at" bo'limidagi karta
  vocabFile: p("Lug'at fayli", "Файл словаря", "Vocabulary file", "Wortschatzdatei"),
  vocabFileHint: p("Ustoz tayyorlagan so'zlar ro'yxati", "Список слов от преподавателя", "Word list prepared by your teacher", "Wortliste von der Lehrkraft"),

  // ── So'z mashqi ──
  practiceWords: p("So'zlarni mashq qilish", "Потренировать слова", "Practise the words", "Wörter üben"),
  practiceHint: p("Tarjimasiga qarab nemischasini tanlang", "По переводу выберите немецкое слово", "Pick the German word for each translation", "Wähle zur Übersetzung das deutsche Wort"),
  practiceAgain: p("Yana mashq qilish", "Потренироваться ещё", "Practise again", "Nochmal üben"),
  chooseGerman: p("Nemischasi qaysi?", "Какое немецкое слово?", "Which German word?", "Welches deutsche Wort?"),
  vocabLearned: p("O'rganildi", "Изучено", "Learned", "Gelernt"),
  vocabMasteredNote: p("Bu darsning barcha so'zlarini bilasiz", "Вы знаете все слова этого урока", "You know every word in this lesson", "Du kennst alle Wörter dieser Lektion"),
  vocabDone: p("Barcha so'zlar to'g'ri!", "Все слова верно!", "Every word correct!", "Alle Wörter richtig!"),
  vocabDoneNote: p("Xato qilgan so'z yana qaytib keldi — endi hammasini bilasiz", "Слова с ошибками повторились — теперь вы знаете все", "Missed words came back around — now you know them all", "Falsche Wörter kamen zurück — jetzt kennst du alle"),
  correctAnswer: p("To'g'ri javob", "Правильный ответ", "Correct answer", "Richtige Antwort"),
  attempts: p("urinish", "попыток", "attempts", "Versuche"),
  accuracy: p("aniqlik", "точность", "accuracy", "Genauigkeit"),
  close: p("Yopish", "Закрыть", "Close", "Schließen"),
  vocabTooFew: p("Mashq uchun kamida 2 ta tarjimali so'z kerak", "Для тренировки нужно минимум 2 слова с переводом", "Practice needs at least 2 words with translations", "Zum Üben braucht es mindestens 2 Wörter mit Übersetzung"),

  // ── Mashq bosqichlari ──
  stage: p("Bosqich", "Этап", "Stage", "Stufe"),
  stage1Name: p("Tanish", "Узнавание", "Recognise", "Erkennen"),
  stage2Name: p("Teskari", "Обратно", "Reverse", "Umgekehrt"),
  stage3Name: p("Yasash", "Собрать", "Build", "Bauen"),
  stage4Name: p("Talaffuz", "Произношение", "Speak", "Aussprache"),
  stage1Hint: p("Tarjimasiga qarab nemischasini tanlang", "По переводу выберите немецкое слово", "Pick the German word for each translation", "Wähle zur Übersetzung das deutsche Wort"),
  stage2Hint: p("Nemischasiga qarab tarjimasini tanlang", "По немецкому слову выберите перевод", "Pick the translation for each German word", "Wähle zum deutschen Wort die Übersetzung"),
  stage3Hint: p("Harflardan so'zni yig'ing", "Соберите слово из букв", "Build the word from its letters", "Setze das Wort aus den Buchstaben zusammen"),
  stage4Hint: p("So'zni ovoz chiqarib ayting", "Произнесите слово вслух", "Say the word out loud", "Sprich das Wort laut aus"),

  // ── Talaffuz bosqichi ──
  sayWord: p("Shu so'zni ayting", "Произнесите это слово", "Say this word", "Sprich dieses Wort"),
  tapToSpeak: p("Bosing va ayting", "Нажмите и говорите", "Tap and speak", "Tippen und sprechen"),
  // `listening` va `checking` nomlari allaqachon band ("Tinglash" ko'nikmasi
  // va vazifa tekshiruvi), shu sabab mikrofon holatlari `mic` bilan
  micListening: p("Eshitilmoqda…", "Слушаю…", "Listening…", "Ich höre zu…"),
  micChecking: p("Tekshirilmoqda…", "Проверяю…", "Checking…", "Wird geprüft…"),
  heardYou: p("Eshitildi", "Услышано", "Heard", "Gehört"),
  noVoice: p("Ovoz eshitilmadi — balandroq ayting", "Голос не слышен — говорите громче", "No voice heard — speak louder", "Keine Stimme gehört — sprich lauter"),
  micDenied: p("Mikrofonga ruxsat berilmadi", "Доступ к микрофону запрещён", "Microphone access denied", "Mikrofonzugriff verweigert"),
  speakUnavailable: p("Hozir tekshirib bo'lmadi, qaytadan urinib ko'ring", "Сейчас не удалось проверить, попробуйте снова", "Could not check right now, try again", "Konnte gerade nicht prüfen, versuche es erneut"),
  skipStage: p("Bu bosqichni o'tkazib yuborish", "Пропустить этот этап", "Skip this stage", "Diese Stufe überspringen"),
  // Gemini bepul tarifi: kuniga 20 ta so'rov
  quotaReached: p("Bugungi tekshiruv chegarasi tugadi — ertaga davom eting yoki Android ilovasida mashq qiling", "Дневной лимит проверок исчерпан — продолжите завтра или в приложении Android", "Today's check limit is used up — continue tomorrow or in the Android app", "Das Tageslimit für Prüfungen ist erreicht — morgen weitermachen oder in der Android-App üben"),
  // Brauzerda talaffuz bosqichi yo'q — nutqni faqat telefonning o'zi taniydi
  speechOnlyInApp: p("Talaffuz bosqichi faqat Android ilovasida ishlaydi", "Этап произношения работает только в приложении Android", "The pronunciation stage works only in the Android app", "Die Aussprache-Stufe funktioniert nur in der Android-App"),
  // Telefonda nutq tanish xizmati ishlamadi (Google xizmati yo'q yoki til yo'q)
  speechServiceMissing: p("Telefonda nutq tanish ishlamadi — Google ilovasi va nemis tili paketi kerak", "Распознавание речи на телефоне не работает — нужны приложение Google и немецкий язык", "Speech recognition failed on this phone — the Google app and German language pack are needed", "Spracherkennung auf diesem Telefon fehlgeschlagen — Google-App und deutsches Sprachpaket nötig"),
  // Ilovaning eski versiyasida nutq tanish plagini yo'q
  updateApp: p("Talaffuz uchun ilovani yangilang: Sozlamalar → Ilovani o'rnatish", "Для произношения обновите приложение: Настройки → Установить приложение", "Update the app for pronunciation: Settings → Install app", "Für die Aussprache App aktualisieren: Einstellungen → App installieren"),
  chooseUzbek: p("Tarjimasi qaysi?", "Какой перевод?", "Which translation?", "Welche Übersetzung?"),
  buildWord: p("Shu so'zni yig'ing", "Соберите это слово", "Build this word", "Setze dieses Wort zusammen"),
  stageDone: p("Bosqich tugadi", "Этап пройден", "Stage complete", "Stufe geschafft"),
  continueNext: p("Davom etish", "Продолжить", "Continue", "Weiter"),
  clearLetters: p("Tozalash", "Очистить", "Clear", "Löschen"),
  exercises: p("Mashqlar", "Упражнения", "Exercises", "Exercises"),
  theory: p("NAZARIYA", "ТЕОРИЯ", "THEORY", "THEORIE"),
  test: p("Test", "Тест", "Test", "Test"),
  watched: p("Ko'rilgan", "Просмотрено", "Watched", "Gesehen"),
  soon: p("tez orada", "скоро", "soon", "bald"),
  noMaterial: p("Bu dars uchun hali material yo'q.", "Для этого урока пока нет материалов.", "No material for this lesson yet.", "Für diese Lektion gibt es noch kein Material."),
  lessonVideo: p("Dars videosi", "Видео урока", "Lesson video", "Lektionsvideo"),
  noVideoYet: p("Dars videosi hali yuklanmagan", "Видео урока пока не загружено", "The lesson video is not uploaded yet", "Das Lektionsvideo ist noch nicht hochgeladen"),
  openVideo: p("Videoni ochish", "Открыть видео", "Open video", "Video öffnen"),
  lessonAssignment: p("Dars topshirig'i", "Задание урока", "Lesson assignment", "Lektionsaufgabe"),
  homeworkTask: p("Uyga vazifa", "Домашнее задание", "Homework", "Hausaufgabe"),

  // ── Dars ichidagi uch bo'lim ──
  tabTasks: p("Vazifa", "Задание", "Tasks", "Aufgabe"),
  noWordsInLesson: p("Bu darsga hali so'z qo'shilmagan", "К этому уроку ещё не добавлены слова", "No words added to this lesson yet", "Zu dieser Lektion wurden noch keine Wörter hinzugefügt"),
  noTasksInLesson: p("Bu darsda vazifa yo'q", "В этом уроке нет заданий", "No tasks in this lesson", "Keine Aufgaben in dieser Lektion"),
  wordCount: p("so'z", "слов", "words", "Wörter"),
  lessonWordsSub: p("Shu darsning so'zlari", "Слова этого урока", "Words from this lesson", "Wörter dieser Lektion"),
  lessonVideoSub: p("Video va dars topshirig'i", "Видео и задание урока", "Video and lesson assignment", "Video und Lektionsaufgabe"),
  lessonHomeworkSub: p("Uyga vazifa va topshirish", "Домашнее задание и сдача", "Homework and submission", "Hausaufgabe und Abgabe"),

  // ── Video bo'limi ──
  videoSection: p("Video", "Видео", "Video", "Video"),
  exercise: p("Mashq", "Упражнение", "Exercise", "Übung"),
  videoExercise: p("Video mashq", "Упражнение к видео", "Video exercise", "Video-Übung"),
  watchVideo: p("Ko'rish", "Смотреть", "Play", "Ansehen"),
  closePlayer: p("Yopish", "Закрыть", "Close", "Schließen"),
  rotateHint: p("Telefonni yon holatga buring", "Поверните телефон горизонтально", "Turn your phone sideways", "Drehe dein Telefon quer"),
  noExercise: p("Bu darsda mashq yo'q", "В этом уроке нет упражнения", "No exercise in this lesson", "Keine Übung in dieser Lektion"),
  openFile: p("Faylni ochish", "Открыть файл", "Open file", "Datei öffnen"),
  prevLesson: p("Oldingi", "Предыдущий", "Previous", "Zurück"),
  nextLesson: p("Keyingi", "Следующий", "Next", "Weiter"),
  attachment: p("Biriktirilgan fayl", "Прикреплённый файл", "Attachment", "Anhang"),
  openFull: p("To'liq ochish", "Открыть полностью", "Open full size", "Vollbild öffnen"),
  markWatched: p("Darsni ko'rib chiqdim", "Я посмотрел урок", "I have watched the lesson", "Ich habe die Lektion gesehen"),
  watchedDone: p("Dars ko'rildi", "Урок просмотрен", "Lesson watched", "Lektion gesehen"),

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

  // ── Sozlamalar sahifasi ──
  accountSection: p("Hisob", "Аккаунт", "Account", "Konto"),
  appSection: p("Ilova", "Приложение", "App", "App"),
  installApp: p("Ilovani o'rnatish", "Установить приложение", "Install the app", "App installieren"),
  installAppSub: p("Telefon bosh ekraniga qo'shish", "Добавить на главный экран", "Add to your home screen", "Zum Startbildschirm hinzufügen"),
  askTeacher: p("Ustozga savol", "Вопрос преподавателю", "Ask the teacher", "Frag die Lehrkraft"),
  askTeacherSub: p("Yozishma orqali savol bering", "Задайте вопрос в переписке", "Ask in the chat", "Frage im Chat"),
  appVersion: p("Ilova versiyasi", "Версия приложения", "App version", "App-Version"),
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
  coinRule: p("Tangani qanday yig'asiz", "Как накопить монеты", "How you earn coins", "So verdienst du Münzen"),
  starRule: p("Yulduzni qanday yig'asiz", "Как накопить звёзды", "How you earn stars", "So verdienst du Sterne"),
  starsNeverSpent: p("Yulduz sarflanmaydi — u sizda abadiy qoladi va darajangizni ko'taradi.", "Звёзды не тратятся — они остаются навсегда и поднимают ваш уровень.", "Stars are never spent — they stay with you and raise your rank.", "Sterne werden nie ausgegeben — sie bleiben und erhöhen deine Stufe."),
  seeRanks: p("Darajalarni ko'rish", "Посмотреть уровни", "See the ranks", "Stufen ansehen"),
  ruleLesson: p("Darsga qatnashgani", "За посещённый урок", "Attended lesson", "Besuchte Lektion"),
  ruleLessonView: p("Dars videosini ko'rgani", "За просмотр урока", "Watched the lesson", "Lektion angesehen"),
  ruleHomework: p("Vazifa bajargani", "За проверенное задание", "Graded task", "Bewertete Aufgabe"),
  rulePerfect: p("To'liq ballga bajargani", "За максимальный балл", "Perfect score", "Volle Punktzahl"),
  ruleGameWin: p("O'yinda yutgani", "За победу в игре", "Game win", "Spielsieg"),
  ruleStreak: p("7 dars ketma-ket", "7 уроков подряд", "7 lessons in a row", "7 Lektionen in Folge"),
  ruleLevelUp: p("Yangi darajaga o'tgani", "За новый уровень", "Level up", "Neues Niveau"),
  ruleRankUp: p("Yulduz pog'onasi", "Звёздная ступень", "Star rank", "Sternenstufe"),
  rewards: p("Sovg'alar", "Призы", "Rewards", "Preise"),
  // Hamyon kartasi
  toCheapest: p("Eng arzon sovg'agacha", "До самого дешёвого приза", "To the cheapest reward", "Bis zum günstigsten Preis"),
  canBuyNow: p("Sovg'a olishga yetadi", "Хватает на приз", "Enough for a reward", "Reicht für einen Preis"),
  notEarnedYet: p("Hali yig'ilmagan", "Пока не начислено", "Not earned yet", "Noch nicht verdient"),
  // Tanga qoidalari uchun qisqa tushuntirish (aylanuvchi banner)
  hintLesson: p("Har bir darsga kelganingiz uchun", "За каждое посещённое занятие", "For every lesson you attend", "Für jede besuchte Unterrichtsstunde"),
  hintLessonView: p("Dars videosini oxirigacha ko'rsangiz", "Если досмотрите видео урока до конца", "When you watch a lesson video to the end", "Wenn Sie das Lektionsvideo zu Ende sehen"),
  hintHomework: p("Uy vazifasini topshirsangiz", "За сданное домашнее задание", "When you submit your homework", "Wenn Sie die Hausaufgabe abgeben"),
  hintPerfect: p("Vazifani to'liq ballga bajarsangiz", "За задание на максимальный балл", "For a full-score assignment", "Für eine Aufgabe mit voller Punktzahl"),
  hintGameWin: p("Jangda g'olib chiqsangiz", "За победу в битве", "When you win a battle", "Wenn Sie ein Duell gewinnen"),
  hintStreak: p("7 dars ketma-ket qatnashsangiz", "За 7 занятий подряд", "For 7 lessons in a row", "Für 7 Stunden in Folge"),
  hintLevelUp: p("Yangi darajaga o'tsangiz", "За переход на новый уровень", "When you reach a new level", "Wenn Sie ein neues Niveau erreichen"),
  hintRankUp: p("Yulduz yig'ib yangi pog'onaga chiqsangiz", "За переход на новую ступень по звёздам", "For climbing a star rank", "Für eine neue Sternenstufe"),
  inTotal: p("jami", "всего", "in total", "gesamt"),
  timesEarned: p("marta", "раз", "times", "mal"),
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
  // Guvohnomadagi yorliq ustuni tor: "2-chi raqam" sig'may, "2-CHI RA..."
  // bo'lib kesilardi. Qatorda raqamning o'zi ko'rinib turgani uchun uni
  // "nechanchi" ekanini yozish shart emas — oddiy "Telefon" tushunarli.
  phone2: p("Telefon", "Телефон", "Phone", "Telefon"),
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
  yourBalance: p("Sizda", "У вас", "You have", "Sie haben"),
  priceLabel: p("Narxi", "Цена", "Price", "Preis"),
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

  // ── Ikkinchi miya (Zweites Gehirn) ──
  brain: p("Ikkinchi miya", "Второй мозг", "Second brain", "Zweites Gehirn"),
  brainSub: p("Shaxsiy rivojlanish daftaringiz", "Ваша тетрадь развития", "Your personal growth notebook", "Ihr Notizbuch für persönliche Entwicklung"),
  brainHint: p(
    "G'oya, maqsad va bilimlaringizni yozing. [[Sarlavha]] yozsangiz — yozuvlar bir-biriga bog'lanadi.",
    "Записывайте идеи, цели и знания. Напишите [[Заголовок]] — заметки свяжутся.",
    "Capture ideas, goals and knowledge. Write [[Title]] to link notes together.",
    "Halten Sie Ideen, Ziele und Wissen fest. Schreiben Sie [[Titel]], um Notizen zu verknüpfen.",
  ),
  newNote: p("Yangi yozuv", "Новая заметка", "New note", "Neue Notiz"),
  noteTitle: p("Sarlavha", "Заголовок", "Title", "Titel"),
  noteText: p("Matn", "Текст", "Text", "Text"),
  noteKind: p("Turi", "Тип", "Type", "Typ"),
  notes: p("yozuv", "заметок", "notes", "Notizen"),
  links: p("bog'lanish", "связей", "links", "Verknüpfungen"),
  graph: p("Graf", "Граф", "Graph", "Graph"),
  backlinks: p("Bu yozuvga havolalar", "Ссылки сюда", "Linked mentions", "Erwähnungen"),
  outlinks: p("Bu yozuvdagi havolalar", "Ссылки отсюда", "Links from here", "Verweise von hier"),
  noBrainNotes: p("Hali yozuv yo'q", "Заметок пока нет", "No notes yet", "Noch keine Notizen"),
  brainStart: p("Birinchi fikringizni yozing — miya shundan boshlanadi.", "Запишите первую мысль — с этого всё начинается.", "Write your first thought — that is where it begins.", "Schreiben Sie Ihren ersten Gedanken — so fängt es an."),
  searchNotes: p("Yozuvlardan qidirish…", "Поиск по заметкам…", "Search notes…", "Notizen durchsuchen…"),
  nothingFound: p("Hech narsa topilmadi", "Ничего не найдено", "Nothing found", "Nichts gefunden"),
  deleteNote: p("Yozuvni o'chirish", "Удалить заметку", "Delete note", "Notiz löschen"),
  deleteConfirm: p("O'chirilsinmi?", "Удалить?", "Delete?", "Löschen?"),
  pin: p("Yuqoriga qadash", "Закрепить", "Pin", "Anheften"),
  pinned: p("Qadalgan", "Закреплённые", "Pinned", "Angeheftet"),
  allTags: p("Barcha teglar", "Все теги", "All tags", "Alle Tags"),
  notCreatedYet: p("hali yaratilmagan", "ещё не создана", "not created yet", "noch nicht erstellt"),
  createIt: p("Yaratish", "Создать", "Create", "Erstellen"),
  open: p("Ochish", "Открыть", "Open", "Öffnen"),
  titleTaken: p("Bu sarlavha band", "Такой заголовок занят", "This title is taken", "Dieser Titel ist vergeben"),
  emptyTitle: p("Sarlavha kerak", "Нужен заголовок", "Title required", "Titel erforderlich"),
  saveFailed: p("Saqlanmadi — qayta urinib ko'ring", "Не сохранено — попробуйте снова", "Not saved — please try again", "Nicht gespeichert — bitte erneut versuchen"),
  noteLimit: p("Yozuvlar chegarasiga yetdingiz", "Достигнут предел заметок", "Note limit reached", "Notizlimit erreicht"),
  emptyGraph: p("Graf bo'sh — avval yozuv qo'shing", "Граф пуст — добавьте заметки", "The graph is empty — add notes first", "Der Graph ist leer — fügen Sie Notizen hinzu"),
  graphHint: p("Tugunni bosing — yozuv ochiladi", "Нажмите на узел — откроется заметка", "Tap a node to open the note", "Tippen Sie auf einen Knoten, um die Notiz zu öffnen"),

  // Yozuv turlari
  kindNOTE: p("Yozuv", "Заметка", "Note", "Notiz"),
  kindIDEA: p("G'oya", "Идея", "Idea", "Idee"),
  kindGOAL: p("Maqsad", "Цель", "Goal", "Ziel"),
  kindBOOK: p("Kitob", "Книга", "Book", "Buch"),
  kindPERSON: p("Inson", "Человек", "Person", "Person"),
  kindDAILY: p("Kundalik", "Дневник", "Daily", "Tagebuch"),

  // ── Server amallarining xatolari (o'quvchiga ko'rinadi) ──
  forbidden: p("Ruxsat yo'q", "Нет доступа", "No access", "Kein Zugriff"),
  studentNotFound: p("O'quvchi topilmadi", "Ученик не найден", "Student not found", "Schüler nicht gefunden"),
  unknownLocale: p("Noma'lum til", "Неизвестный язык", "Unknown language", "Unbekannte Sprache"),

  // ── Profil tahriri ──
  nameTooShort: p("Ism-familiya juda qisqa", "Имя и фамилия слишком короткие", "Name is too short", "Name ist zu kurz"),
  nameTooLong: p("Ism-familiya juda uzun", "Имя и фамилия слишком длинные", "Name is too long", "Name ist zu lang"),
  birthInvalid: p("Tug'ilgan sana noto'g'ri", "Неверная дата рождения", "Invalid date of birth", "Ungültiges Geburtsdatum"),
  phoneInvalid: p("Telefon raqami noto'g'ri", "Неверный номер телефона", "Invalid phone number", "Ungültige Telefonnummer"),
  phone2Invalid: p("Qo'shimcha telefon noto'g'ri", "Неверный дополнительный номер", "Invalid second phone number", "Ungültige zweite Telefonnummer"),
  imageInvalid: p("Rasm manzili noto'g'ri", "Неверный адрес изображения", "Invalid image address", "Ungültige Bildadresse"),
  paid: p("To'landi", "Оплачено", "Paid", "Bezahlt"),
  passwordChanged: p("Parol o'zgartirildi ✓", "Пароль изменён ✓", "Password changed ✓", "Passwort geändert ✓"),
  currentPassword: p("Joriy parol", "Текущий пароль", "Current password", "Aktuelles Passwort"),
  newPassword: p("Yangi parol", "Новый пароль", "New password", "Neues Passwort"),
  repeatPassword: p("Yangi parol (takror)", "Новый пароль (повторите)", "New password (repeat)", "Neues Passwort (wiederholen)"),
  saving: p("Saqlanmoqda…", "Сохранение…", "Saving…", "Wird gespeichert…"),

  // ── Dars vazifalari ──
  score: p("Ball", "Балл", "Score", "Punkte"),
  taskAccepted: p("Vazifa qabul qilindi", "Задание принято", "Task accepted", "Aufgabe angenommen"),
  taskReturned: p("Qayta ishlash kerak", "Нужно доработать", "Needs rework", "Überarbeitung nötig"),
  taskChecking: p("Tekshirilmoqda", "На проверке", "Being checked", "Wird geprüft"),
  uploadFailed: p("Faylni yuklab bo'lmadi", "Не удалось загрузить файл", "Could not upload the file", "Datei konnte nicht hochgeladen werden"),
  addTextOrFile: p("Matn yoki fayl qo'shing", "Добавьте текст или файл", "Add text or a file", "Text oder Datei hinzufügen"),
  sendFailed: p("Yuborib bo'lmadi", "Не удалось отправить", "Could not send", "Senden fehlgeschlagen"),
  examDue: p("Imtihon muddati:", "Срок экзамена:", "Exam deadline:", "Prüfungstermin:"),
  submitDue: p("Topshirish muddati:", "Срок сдачи:", "Due date:", "Abgabefrist:"),
  maxScore: p("Maks. ball", "Макс. балл", "Max score", "Max. Punkte"),
  mySubmissions: p("Mening jo'natmalarim", "Мои отправки", "My submissions", "Meine Abgaben"),
  filesCount: p("Fayllar soni", "Файлов", "Files", "Dateien"),
  nothingSentYet: p("Hali hech narsa yuborilmagan.", "Пока ничего не отправлено.", "Nothing sent yet.", "Noch nichts gesendet."),
  answerPlaceholder: p("Javobingiz yoki havola (masalan github.com/...)", "Ваш ответ или ссылка (например github.com/...)", "Your answer or a link (e.g. github.com/...)", "Ihre Antwort oder ein Link (z. B. github.com/...)"),
  fileChosen: p("Fayl tanlandi", "Файл выбран", "File chosen", "Datei gewählt"),
  addFile: p("Fayl qo'shish", "Добавить файл", "Add file", "Datei hinzufügen"),
  remove: p("Olib tashlash", "Убрать", "Remove", "Entfernen"),
  teacherNote: p("O'qituvchi izohi", "Комментарий преподавателя", "Teacher's note", "Kommentar der Lehrkraft"),
  checkedBy: p("Tekshiruvchi", "Проверил", "Checked by", "Geprüft von"),
  passedCount: p("O'tganlar", "Сдали", "Passed", "Bestanden"),
  persons: p("nafar", "чел.", "students", "Schüler"),

  // ── Reyting ──
  scopeGroup: p("Guruh ichida", "Внутри группы", "Within the group", "In der Gruppe"),
  scopeBranch: p("Filial bo'yicha", "По филиалу", "Across the branch", "Nach Filiale"),
  scopeCenter: p("Butun markaz", "Весь центр", "Whole centre", "Ganzes Zentrum"),
  basisAttendance: p("qatnashgan darslar soni", "посещённых уроков", "lessons attended", "besuchte Lektionen"),
  basisCoins: p("yig'ilgan tanga", "заработанных монет", "coins earned", "gesammelte Münzen"),
  basisScore: p("o'rtacha ball, %", "средний балл, %", "average score, %", "Durchschnitt, %"),
  yourPlace: p("Sizning o'rningiz", "Ваше место", "Your place", "Ihr Platz"),
  totalLabel: p("jami", "всего", "total", "gesamt"),
  studentsUnit: p("o'quvchi", "учеников", "students", "Schüler"),
  noRatingYet: p("Reyting hali tuzilmagan", "Рейтинг ещё не составлен", "No rating yet", "Noch keine Rangliste"),
  ratingAfterLessons: p("Darslar boshlangach shu yerda ko'rinadi.", "Появится после начала уроков.", "It appears once lessons begin.", "Erscheint, sobald der Unterricht beginnt."),
  youTag: p("siz", "вы", "you", "Sie"),
  tiedResult: p("teng natija", "равный результат", "tied", "gleichauf"),
  firstShownOf: p("Birinchi {n} ta ko'rsatilgan — jami {total} o'quvchi", "Показаны первые {n} — всего {total} учеников", "First {n} shown — {total} students in total", "Die ersten {n} angezeigt — insgesamt {total} Schüler"),

  // ── Jang (o'yinlar) ──
  modeAi: p("AI ga qarshi", "Против ИИ", "Against AI", "Gegen KI"),
  modeAiSub: p("Sun'iy intellekt bilan bellashing", "Сразитесь с искусственным интеллектом", "Compete against the AI", "Tritt gegen die KI an"),
  modeDuel: p("Duel", "Дуэль", "Duel", "Duell"),
  modeDuelSub: p("Guruhdoshingizni jangga chaqiring", "Вызовите одногруппника", "Challenge a classmate", "Fordere einen Mitschüler heraus"),
  modeGroup: p("Guruhli o'yin", "Групповая игра", "Group game", "Gruppenspiel"),
  modeGroupSub: p("Butun guruh bitta savollar bilan", "Вся группа — одни и те же вопросы", "The whole group, same questions", "Die ganze Gruppe, gleiche Fragen"),
  lobbyVocabSub: p("To'g'ri so'zni tanlang", "Выберите верное слово", "Pick the right word", "Wähle das richtige Wort"),
  lobbyWordgame: p("So'z o'yini", "Игра в слова", "Word game", "Wortspiel"),
  lobbyWordgameSub: p("Harflardan tuzing", "Соберите из букв", "Build from letters", "Aus Buchstaben bilden"),
  lobbyCrossword: p("Krossvord", "Кроссворд", "Crossword", "Kreuzworträtsel"),
  lobbyCrosswordSub: p("Ta'rif bo'yicha yozing", "Напишите по описанию", "Write from the definition", "Nach der Beschreibung schreiben"),
  lobbyGrammar: p("Grammatika", "Грамматика", "Grammar", "Grammatik"),
  lobbyGrammarSub: p("der, die yoki das", "der, die или das", "der, die or das", "der, die oder das"),
  taskWordgame: p("Harflardan so'z tuzing", "Соберите слово из букв", "Build the word from letters", "Bilde das Wort aus Buchstaben"),
  taskGrammar: p("Artiklni tanlang", "Выберите артикль", "Pick the article", "Wähle den Artikel"),
  waitingForYou: p("Sizni kutmoqda", "Ждут вас", "Waiting for you", "Wartet auf dich"),
  challengedYou: p("{name} chaqirdi", "{name} вызвал(а) вас", "{name} challenged you", "{name} hat dich herausgefordert"),
  groupChampionship: p("Guruh chempionati", "Чемпионат группы", "Group championship", "Gruppenmeisterschaft"),
  playedPeople: p("{n} kishi o'ynadi", "сыграли: {n}", "{n} played", "{n} haben gespielt"),
  play: p("O'ynash", "Играть", "Play", "Spielen"),
  battleType: p("Jang turi", "Тип битвы", "Battle type", "Kampfart"),
  yourRival: p("Raqibingiz", "Ваш соперник", "Your rival", "Dein Gegner"),
  noRivals: p("Guruhingizda ilovaga ulangan boshqa o'quvchi yo'q", "В вашей группе нет других учеников с приложением", "No other classmates are using the app yet", "Kein anderer Mitschüler nutzt bisher die App"),
  rivalsAppear: p("Ular ilovaga kirgach shu yerda chiqadi.", "Они появятся здесь, когда войдут в приложение.", "They will appear here once they sign in.", "Sie erscheinen hier, sobald sie sich anmelden."),
  gameType: p("O'yin turi", "Тип игры", "Game type", "Spielart"),
  notEnoughWords: p("So'zlar yetarli emas", "Недостаточно слов", "Not enough words", "Nicht genug Wörter"),
  chooseRival: p("Raqibingizni tanlang", "Выберите соперника", "Choose a rival", "Wähle einen Gegner"),
  sendChallenge: p("Chaqiruv yuborish", "Отправить вызов", "Send challenge", "Herausforderung senden"),
  startBattle: p("Jangni boshlang", "Начать битву", "Start the battle", "Kampf starten"),
  openChallengeFailed: p("Chaqiruvni ochib bo'lmadi", "Не удалось открыть вызов", "Could not open the challenge", "Herausforderung konnte nicht geöffnet werden"),
  youWon: p("Siz yutdingiz!", "Вы победили!", "You won!", "Du hast gewonnen!"),
  drawResult: p("Durrang", "Ничья", "Draw", "Unentschieden"),
  nextTime: p("Keyingi safar!", "В следующий раз!", "Next time!", "Nächstes Mal!"),
  youLost: p("Bu safar yutqazdingiz", "В этот раз вы проиграли", "You lost this time", "Diesmal verloren"),
  resultSaved: p("Natijangiz yozildi", "Ваш результат записан", "Your result is saved", "Dein Ergebnis wurde gespeichert"),
  you: p("Siz", "Вы", "You", "Du"),
  pctCorrect: p("{p}% to'g'ri", "{p}% верно", "{p}% correct", "{p}% richtig"),
  duelWait: p("Raqibingiz ham o'ynagach, natija bildirishnoma bo'lib keladi.", "Когда соперник тоже сыграет, результат придёт уведомлением.", "Once your rival plays too, the result arrives as a notification.", "Sobald dein Gegner gespielt hat, kommt das Ergebnis als Mitteilung."),
  groupWait: p("Guruhdoshlaringiz o'ynagach, kim oldinda ekani ko'rinadi.", "Когда сыграют одногруппники, будет видно, кто впереди.", "Once your classmates play, you will see who leads.", "Sobald deine Mitschüler gespielt haben, siehst du, wer vorne liegt."),
  playAgain: p("Yana o'ynash", "Играть ещё", "Play again", "Nochmal spielen"),
  answerPh: p("Javobingiz…", "Ваш ответ…", "Your answer…", "Deine Antwort…"),
  correctBang: p("To'g'ri!", "Верно!", "Correct!", "Richtig!"),
  check: p("Tekshirish", "Проверить", "Check", "Prüfen"),
  rival: p("Raqib", "Соперник", "Rival", "Gegner"),
  cantChallengeSelf: p("O'zingizga chaqiruv yubora olmaysiz", "Нельзя вызвать самого себя", "You cannot challenge yourself", "Du kannst dich nicht selbst herausfordern"),
  notInGroup: p("Siz hali guruhga biriktirilmagansiz", "Вы ещё не прикреплены к группе", "You are not assigned to a group yet", "Du bist noch keiner Gruppe zugeordnet"),
  rivalNotInGroup: p("Bu o'quvchi guruhingizda topilmadi", "Этот ученик не найден в вашей группе", "This student is not in your group", "Dieser Schüler ist nicht in deiner Gruppe"),
  challengeNotFound: p("Chaqiruv topilmadi", "Вызов не найден", "Challenge not found", "Herausforderung nicht gefunden"),
  challengeExpired: p("Chaqiruv muddati tugagan", "Срок вызова истёк", "The challenge has expired", "Die Herausforderung ist abgelaufen"),
  challengeNotYours: p("Bu chaqiruv sizga tegishli emas", "Этот вызов не для вас", "This challenge is not yours", "Diese Herausforderung gilt nicht dir"),
  duelInviteTitle: p("Sizga duel chaqiruvi", "Вам вызов на дуэль", "Duel challenge for you", "Duell-Herausforderung für dich"),
  duelInviteBody: p("{name} sizni jangga chaqirdi. Jang bo'limida javob bering.", "{name} вызвал(а) вас на битву. Ответьте в разделе «Битва».", "{name} challenged you to a battle. Reply in the Battle section.", "{name} hat dich zum Kampf herausgefordert. Antworte im Bereich Kampf."),
  duelResultTitle: p("Duel yakuni: {verdict}", "Итог дуэли: {verdict}", "Duel result: {verdict}", "Duell-Ergebnis: {verdict}"),
  duelResultBody: p("{a} : {b} ({name})", "{a} : {b} ({name})", "{a} : {b} ({name})", "{a} : {b} ({name})"),

  // ── Market ──
  giftUnavailable: p("Sovg'a mavjud emas", "Подарок недоступен", "Gift unavailable", "Geschenk nicht verfügbar"),
  giftOtherBranch: p("Bu sovg'a boshqa filialda", "Этот подарок в другом филиале", "This gift is at another branch", "Dieses Geschenk ist in einer anderen Filiale"),
  outOfStock: p("Zaxira tugagan", "Закончился", "Out of stock", "Ausverkauft"),
  notEnoughCoins: p("Tanga yetarli emas ({have}/{need})", "Недостаточно монет ({have}/{need})", "Not enough coins ({have}/{need})", "Nicht genug Münzen ({have}/{need})"),
  marketNewOrder: p("Market: yangi buyurtma", "Маркет: новый заказ", "Market: new order", "Markt: neue Bestellung"),
  marketOrderBody: p("{name} — {item} ({price} tanga)", "{name} — {item} ({price} монет)", "{name} — {item} ({price} coins)", "{name} — {item} ({price} Münzen)"),

  // ── Ustoz bilan chat ──
  messageEmpty: p("Xabar bo'sh", "Пустое сообщение", "Message is empty", "Nachricht ist leer"),
  messageTooLong: p("Xabar {n} belgidan oshmasin", "Сообщение не длиннее {n} символов", "Message must be at most {n} characters", "Nachricht darf höchstens {n} Zeichen haben"),
  studentWroteYou: p("{name} xabar yozdi", "{name} написал(а) сообщение", "{name} sent a message", "{name} hat geschrieben"),

  // ── Xato sahifasi ──
  errTitle: p("Nimadir noto'g'ri ketdi", "Что-то пошло не так", "Something went wrong", "Etwas ist schiefgelaufen"),
  errBody: p("Sahifani ochib bo'lmadi. Internetni tekshirib, qaytadan urinib ko'ring. Takrorlansa — administratorga xabar bering.", "Не удалось открыть страницу. Проверьте интернет и попробуйте снова. Если повторится — сообщите администратору.", "The page could not be opened. Check your connection and try again. If it repeats, tell the administrator.", "Die Seite konnte nicht geöffnet werden. Prüfe die Verbindung und versuche es erneut. Bei Wiederholung den Administrator informieren."),
  retry: p("Qaytadan urinish", "Попробовать снова", "Try again", "Erneut versuchen"),
  toHome: p("Bosh sahifaga", "На главную", "To home", "Zur Startseite"),

  // ── Hisob bog'lanmagan ──
  accountNotLinked: p("Hisob bog'lanmagan", "Аккаунт не привязан", "Account not linked", "Konto nicht verknüpft"),
  accountNotLinkedBody: p("Sizning hisobingizga o'quvchi profili biriktirilmagan yoki u o'chirilgan. Administratorga murojaat qiling.", "К вашему аккаунту не привязан профиль ученика или он удалён. Обратитесь к администратору.", "No student profile is linked to your account, or it was removed. Contact the administrator.", "Mit deinem Konto ist kein Schülerprofil verknüpft oder es wurde entfernt. Wende dich an die Verwaltung."),

  // ── Bildirishnomalar ro'yxati ──
  noMessagesHint: p("Hozircha xabar yo'q.", "Пока сообщений нет.", "No messages yet.", "Noch keine Mitteilungen."),
  markAllRead: p("Hammasini o'qilgan deb belgilash", "Отметить всё прочитанным", "Mark all as read", "Alle als gelesen markieren"),

  // ── Yozuv sintaksisi eslatmasi ──
  mdLink: p("[[Sarlavha]]", "[[Заголовок]]", "[[Title]]", "[[Titel]]"),
  mdTag: p("#teg", "#тег", "#tag", "#tag"),
  mdHeading: p("# bo'lim", "# раздел", "# section", "# Abschnitt"),
  mdList: p("- ro'yxat", "- список", "- list", "- Liste"),
  mdCheck: p("- [ ] belgi", "- [ ] отметка", "- [ ] checkbox", "- [ ] Kästchen"),

  // ── Lug'at ustuni ──
  uzbekLabel: p("O'zbekcha", "Узбекский", "Uzbek", "Usbekisch"),
} as const;

export type StudentStrings = { [K in keyof typeof DICT]: string };

export function S(locale: Locale): StudentStrings {
  const out = {} as Record<string, string>;
  for (const [k, v] of Object.entries(DICT)) out[k] = v[locale] ?? v.uz;
  return out as StudentStrings;
}

export type StudentKey = keyof typeof DICT;
export type StudentText = T;

/** "{name}" kabi joy tutuvchilarni to'ldiradi: fill("{n} kishi", { n: 3 }) → "3 kishi" */
export function fill(s: string, vars: Record<string, string | number>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/**
 * Bitta kalitning TO'RT tili — oluvchining tili keyin aniqlanadigan joylar
 * uchun (bildirishnoma: yozayotgan o'quvchi emas, OLUVCHI tilida ko'rinsin).
 * Joy tutuvchi qiymati satr, son yoki o'zi to'rt tilli matn bo'lishi mumkin.
 */
export function LT(key: StudentKey, vars: Record<string, string | number | T> = {}): T {
  const v = DICT[key];
  const one = (locale: Locale) => {
    let out: string = v[locale];
    for (const [k, val] of Object.entries(vars)) {
      const s = typeof val === "object" ? val[locale] : String(val);
      out = out.split(`{${k}}`).join(s);
    }
    return out;
  };
  return { uz: one("uz"), ru: one("ru"), en: one("en"), de: one("de") };
}
