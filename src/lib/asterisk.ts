// Telefoniya — Asterisk integratsiyasi (FAQAT server: net/fs ishlatadi).
// Spec: Asterisk 18+ PBX + AMI (Manager Interface). Bu yordamchi:
//   - webrtc-config (operator SIP ext + parol + STUN/TURN) — brauzer softphone uchun
//   - AMI Originate (chiquvchi qo'ng'iroq) — qisqa muddatli TCP soket orqali
//   - UZ telefon raqamini normallashtirish
// Doimiy AMI hodisa tinglash — alohida worker (scripts/ami-worker.mjs).

import net from "node:net";

// ─── ENV konfiguratsiya ───
export function telephonyEnv() {
  const publicHost = process.env.PUBLIC_HOST ?? "";
  const domain = process.env.SIP_DOMAIN || process.env.PUBLIC_DOMAIN || "";
  return {
    publicHost,
    domain,
    wsUrl: process.env.WS_URL || (publicHost ? `ws://${publicHost}:8088/ws` : ""),
    wssUrl: process.env.WSS_URL || (domain ? `wss://${domain}/ws` : ""),
    turnUser: process.env.TURN_USERNAME ?? "",
    turnCred: process.env.TURN_CREDENTIAL ?? "",
    recordingDir: process.env.ASTERISK_RECORDING_DIR || "/var/spool/asterisk/recording",
    trunkCallerId: process.env.SIP_TRUNK_CALLER_ID || process.env.SIP_TRUNK_USERNAME || "",
  };
}

function amiEnv() {
  return {
    host: process.env.ASTERISK_HOST || "127.0.0.1",
    port: Number(process.env.ASTERISK_AMI_PORT || 5038),
    user: process.env.ASTERISK_AMI_USER || "",
    pass: process.env.ASTERISK_AMI_PASS || "",
  };
}

export function amiConfigured(): boolean {
  const a = amiEnv();
  return Boolean(a.user && a.pass);
}

// Extension → SIP paroli.  glive3 yoki operator3 → SIP_OPERATOR3_PASS
// (yangi instans endpointlari "glive" prefiksi bilan — eski loyihaning "operator" bilan to'qnashmasligi uchun)
export function operatorPassword(ext: string): string | null {
  // Bo'sh joy/registr farqiga chidamli: "operator 4", "GLIVE4", " glive4 " —
  // hammasi 4-raqamli endpoint deb tushuniladi. Ilgari bunday yozuv jimgina
  // null qaytarib, softphone'da "Telefoniya hali sozlanmagan" ko'rsatardi.
  const m = /^(?:glive|operator)\s*(\d+)$/i.exec(String(ext ?? "").trim());
  if (!m) return null;
  return process.env[`SIP_OPERATOR${m[1]}_PASS`] || null;
}

/** SIP raqamini Asterisk endpoint nomiga keltiradi: "operator 4" → "glive4" */
export function normalizeExtension(ext: string): string | null {
  const m = /^(?:glive|operator)\s*(\d+)$/i.exec(String(ext ?? "").trim());
  return m ? `glive${m[1]}` : null;
}

export interface WebrtcConfig {
  wsUrl: string;
  wssUrl: string;
  extension: string;
  password: string;
  domain: string;
  stunServer?: { urls: string };
  turnServer?: { urls: string; username: string; credential: string };
}

export function webrtcConfigFor(ext: string): WebrtcConfig | null {
  const e = telephonyEnv();
  const password = operatorPassword(ext);
  // Asterisk'ga HAR DOIM normallashtirilgan nom yuboriladi — bazadagi
  // yozuvda bo'sh joy bo'lsa ham SIP ro'yxatdan o'tishi buzilmasin
  const endpoint = normalizeExtension(ext);
  if (!password || !endpoint) return null;
  return {
    wsUrl: e.wsUrl,
    wssUrl: e.wssUrl,
    extension: endpoint,
    password,
    domain: e.domain,
    stunServer: e.publicHost ? { urls: `stun:${e.publicHost}:3478` } : undefined,
    turnServer: e.publicHost && e.turnUser ? { urls: `turn:${e.publicHost}:3478`, username: e.turnUser, credential: e.turnCred } : undefined,
  };
}

// UZ raqam: 998XXXXXXXXX ko'rinishiga keltiradi
export function normalizeUzPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  // MUHIM: 9 xonali mahalliy raqam AVVAL tekshiriladi — "99 888 99 99" ning
  // o'zi 998 bilan boshlanadi va aks holda mamlakat kodi deb qabul qilinardi.
  if (d.length === 9) return "998" + d;
  if (d.startsWith("998")) return d.slice(0, 12);
  if (d.length === 10 && (d.startsWith("0") || d.startsWith("8"))) return "998" + d.slice(1);
  return d;
}

// ─── AMI: bitta action yuborish (qisqa muddatli soket) ───
type Pairs = [string, string][];
const encode = (pairs: Pairs) => pairs.map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n";

function parseBlocks(buf: string): Record<string, string>[] {
  return buf.split("\r\n\r\n").filter(Boolean).map((blk) =>
    Object.fromEntries(
      blk.split("\r\n").filter(Boolean).map((line) => {
        const i = line.indexOf(":");
        return i === -1 ? [line.trim(), ""] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
    ),
  );
}

export interface AmiResult { ok: boolean; message?: string; raw?: string }

function amiSend(pairs: Pairs, actionId: string, timeoutMs = 8000): Promise<AmiResult> {
  const cfg = amiEnv();
  if (!cfg.user || !cfg.pass) return Promise.resolve({ ok: false, message: "AMI sozlanmagan (.env)" });
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: cfg.host, port: cfg.port });
    let buf = "";
    let sent = false;
    let settled = false;
    const finish = (r: AmiResult) => { if (settled) return; settled = true; clearTimeout(timer); try { sock.end(); } catch {} resolve(r); };
    const timer = setTimeout(() => finish({ ok: false, message: "AMI timeout" }), timeoutMs);
    sock.on("error", (e) => finish({ ok: false, message: e.message }));
    sock.on("data", (chunk) => {
      buf += chunk.toString();
      if (!sent && buf.includes("Asterisk Call Manager")) {
        sent = true;
        sock.write(encode([["Action", "Login"], ["Username", cfg.user], ["Secret", cfg.pass], ["ActionID", "login-" + actionId]]));
        sock.write(encode([...pairs, ["ActionID", actionId]]));
      }
      const mine = parseBlocks(buf).find((b) => b.ActionID === actionId && b.Response);
      if (mine) finish({ ok: mine.Response === "Success", message: mine.Message, raw: buf });
    });
  });
}

let seq = 0;
const nextId = () => `glive-${Date.now().toString(36)}-${(seq++).toString(36)}`;

// Chiquvchi qo'ng'iroq: avval operatorni jiringlatadi (PJSIP/operatorN),
// javob bergach gl-from-internal dialplan mijozni teradi (trunk orqali).
// DIQQAT: kontekst "gl-from-internal" — YANGI instansniki. Eski loyihaning
// "from-internal" konteksti bilan aralashtirmaslik kerak.
export function amiOriginate(opts: {
  extension: string; // operator SIP ext (operator3)
  number: string; // mijoz raqami (normalized)
  callerId?: string;
  callRecordId?: string;
  timeoutMs?: number;
}): Promise<AmiResult> {
  const id = nextId();
  const pairs: Pairs = [
    ["Action", "Originate"],
    ["Channel", `PJSIP/${opts.extension}`],
    ["Context", process.env.ASTERISK_CONTEXT || "gl-from-internal"],
    ["Exten", opts.number],
    ["Priority", "1"],
    ["CallerID", opts.callerId || opts.extension],
    ["Timeout", String(opts.timeoutMs ?? 30000)],
    ["Async", "true"],
  ];
  if (opts.callRecordId) pairs.push(["Variable", `CALLRECORD_ID=${opts.callRecordId}`]);
  return amiSend(pairs, id, (opts.timeoutMs ?? 30000) + 4000);
}

// Ulanishni tekshirish (Ping)
export function amiPing(): Promise<AmiResult> {
  return amiSend([["Action", "Ping"]], nextId(), 5000);
}
