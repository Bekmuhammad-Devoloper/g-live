export interface VCall {
  id: string;
  direction: string;
  status: string;
  operatorKey: string | null;
  operatorName: string | null;
  leadId: string | null;
  contactName: string | null;
  leadManagerName: string | null;
  phone: string;
  phoneLabel: string;
  phoneUnknown: boolean;
  duration: number;
  durationLabel: string;
  recordingSrc: string | null;
  comment: string | null;
  callbackStatus: string;
  dayLabel: string;
  timeLabel: string;
  agoLabel: string;
  callbackAtLabel: string | null;
  daysAgo: number;
}

export interface CallStats {
  total: number;
  answered: number;
  missed: number;
  incoming: number;
  outgoing: number;
  avgDurationLabel: string;
  missedPending: number;
  loaded: number;
}

export interface VOperator {
  key: string;
  name: string;
}
