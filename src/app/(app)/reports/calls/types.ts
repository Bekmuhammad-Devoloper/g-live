// Qo'ng'iroqlar markazi — server → klient uzatiladigan tiplar.
// MUHIM: funksiyalar server komponentdan klientga o'tolmaydi, shuning uchun
// barcha sana/telefon/davomiylik matnlari serverda oldindan formatlanadi.

export interface VCall {
  id: string;
  direction: string; // INCOMING | OUTGOING
  status: string; // ANSWERED | MISSED | BUSY | NO_ANSWER | FAILED | CANCELLED
  operatorKey: string | null; // filtrlash kaliti (operatorId yoki "name:...")
  operatorName: string | null;
  leadId: string | null;
  contactName: string | null;
  leadManagerName: string | null; // lidga biriktirilgan operator (Lead.manager)
  phone: string; // xom raqam (qo'ng'iroq qilish uchun)
  phoneLabel: string; // "+998 90 123-45-67" yoki "Noma'lum raqam"
  phoneUnknown: boolean;
  duration: number; // sekund
  durationLabel: string; // "3:24"
  recordingSrc: string | null; // /api/telephony/recordings/<file>.wav
  comment: string | null;
  callbackStatus: string; // NONE | PENDING | CALLED_BACK | NOT_NEEDED
  dayLabel: string; // "Bugun" | "Kecha" | "09.08.2026"
  timeLabel: string; // "14:35"
  agoLabel: string; // "12 daq oldin"
  callbackAtLabel: string | null; // "Bugun 15:02"
  daysAgo: number; // vaqt filtri uchun (0 = bugun)
}

export interface CallStats {
  total: number;
  answered: number;
  missed: number;
  incoming: number;
  outgoing: number;
  avgDurationLabel: string;
  missedPending: number;
  loaded: number; // jadvalga yuklangan qatorlar soni
}

export interface VOperator {
  key: string;
  name: string;
}
