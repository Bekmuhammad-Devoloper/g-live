"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { markCalledBack } from "../reports/calls/actions";

type UAStatus = "init" | "connecting" | "registered" | "failed" | "disabled";

const NORMAL_CAUSES = new Set([
  "Canceled", "Terminated", "BYE", "Busy", "Rejected", "Unavailable",
  "No Answer", "Redirected", "Dialog Error",
]);
const isRealError = (c: string) => !NORMAL_CAUSES.has(c);

function causeText(c: string, locale: Locale): string {
  const M: Record<string, { uz: string; ru: string; en: string; de: string }> = {
    Canceled: { uz: "Chaqiruvchi qo'ng'iroqni uzdi", ru: "Звонящий положил трубку", en: "Caller hung up", de: "Anrufer hat aufgelegt" },
    Terminated: { uz: "Qo'ng'iroq tugadi", ru: "Звонок завершён", en: "Call ended", de: "Anruf beendet" },
    BYE: { uz: "Qo'ng'iroq tugadi", ru: "Звонок завершён", en: "Call ended", de: "Anruf beendet" },
    Busy: { uz: "Abonent band", ru: "Абонент занят", en: "Line busy", de: "Besetzt" },
    Rejected: { uz: "Qo'ng'iroq rad etildi", ru: "Звонок отклонён", en: "Call rejected", de: "Anruf abgelehnt" },
    Unavailable: { uz: "Abonent mavjud emas", ru: "Абонент недоступен", en: "Unavailable", de: "Nicht erreichbar" },
    "No Answer": { uz: "Javob berilmadi", ru: "Нет ответа", en: "No answer", de: "Keine Antwort" },
    "Request Timeout": { uz: "Vaqt tugadi — javob kelmadi", ru: "Тайм-аут запроса", en: "Request timed out", de: "Zeitüberschreitung der Anfrage" },
    "Connection Error": { uz: "Aloqa uzildi", ru: "Ошибка соединения", en: "Connection error", de: "Verbindungsfehler" },
    "Internal Error": { uz: "Ichki xatolik", ru: "Внутренняя ошибка", en: "Internal error", de: "Interner Fehler" },
    "User Denied Media Access": { uz: "Mikrofonga ruxsat berilmadi", ru: "Нет доступа к микрофону", en: "Microphone access denied", de: "Mikrofonzugriff verweigert" },
    "Incompatible SDP": { uz: "Media sozlamalari mos kelmadi", ru: "Несовместимые медиа-настройки", en: "Incompatible media settings", de: "Inkompatible Medieneinstellungen" },
  };
  const t = M[c];
  if (t) return tr(locale, t);
  return c ? tr(locale, { uz: "Qo'ng'iroq uzildi: ", ru: "Звонок прерван: ", en: "Call ended: ", de: "Anruf beendet: " }) + c : "";
}
type CallState = "none" | "incoming" | "outgoing" | "active";
type Tab = "dial" | "history";
type HistView = "mine" | "missed";

interface CallRow { id: string; direction: string; status: string; phone: string; contactName: string | null; duration: number; startedAt: string; callbackStatus?: string; operatorName?: string | null }

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const p2 = (n: number) => String(n).padStart(2, "0");
const fmtWhen = (iso: string) => { const d = new Date(iso); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };

export default function Softphone({ locale, canConfigure = false }: { locale: Locale; canConfigure?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<UAStatus>("init");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("dial");
  const [callState, setCallState] = useState<CallState>("none");
  const [dial, setDial] = useState("");
  const [peer, setPeer] = useState("");
  const [peerNumber, setPeerNumber] = useState("");
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [ext, setExt] = useState("");

  const [histQ, setHistQ] = useState("");
  const [histLoading, setHistLoading] = useState(false);
  const [calls, setCalls] = useState<CallRow[] | null>(null);
  const [histView, setHistView] = useState<HistView>("mine");
  const [missedPending, setMissedPending] = useState(0);

  const uaRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iceRef = useRef<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kaRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOutRef = useRef(false);
  const amiOutRef = useRef(false);
  const callIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const dialInputRef = useRef<HTMLInputElement | null>(null);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [launcherPos, setLauncherPos] = useState<{ x: number; y: number } | null>(null);
  const panelDraggedRef = useRef(false);
  type DragTarget = "panel" | "launcher";
  const dragRef = useRef<{ target: DragTarget; startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  const beginDrag = useCallback((target: DragTarget) => (e: React.MouseEvent) => {
    const el = target === "panel" ? panelRef.current : launcherRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = { target, startX: e.clientX, startY: e.clientY, baseX: r.left, baseY: r.top, moved: false };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const el = d.target === "panel" ? panelRef.current : launcherRef.current;
      const w = el?.offsetWidth ?? 56;
      const h = el?.offsetHeight ?? 56;
      let x = d.baseX + (e.clientX - d.startX);
      let y = d.baseY + (e.clientY - d.startY);
      if (Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3) {
        d.moved = true;
        if (d.target === "panel") panelDraggedRef.current = true;
      }
      x = Math.min(Math.max(x, 4), window.innerWidth - w - 4);
      y = Math.min(Math.max(y, 4), window.innerHeight - h - 4);
      (d.target === "panel" ? setPos : setLauncherPos)({ x, y });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d && d.target === "launcher" && !d.moved) setOpen((o) => !o);
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    if (!open || panelDraggedRef.current) return;
    const icon = launcherRef.current?.getBoundingClientRect();
    if (!icon) return;
    const PANEL_W = 336, PANEL_H = 460, GAP = 12;
    let x = icon.right - PANEL_W;
    let y = icon.top - GAP - PANEL_H;
    if (y < 4) y = Math.min(icon.bottom + GAP, window.innerHeight - PANEL_H - 4);
    x = Math.min(Math.max(x, 4), window.innerWidth - PANEL_W - 4);
    y = Math.max(y, 4);
    setPos({ x, y });
  }, [open]);

  useEffect(() => setMounted(true), []);

  const startTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const getStream = useCallback(async (): Promise<MediaStream> => {
    const silent = (): MediaStream => {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      const dst = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g); g.connect(dst); osc.start();
      return dst.stream;
    };
    try {
      const s = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("mic-timeout")), 3000)),
      ]);
      return s as MediaStream;
    } catch {
      setErr(tr(locale, {
        uz: "Mikrofon ochilmadi — ovozsiz rejimda ulandi",
        ru: "Микрофон недоступен — подключено без звука",
        en: "Microphone unavailable — connected muted",
        de: "Mikrofon nicht verfügbar — stumm verbunden",
      }));
      return silent();
    }
  }, [locale]);

  const forceIceTimeout = useCallback((session: any) => {
    let ready: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    session.on("icecandidate", (evt: any) => {
      if (!timer && evt?.ready) {
        ready = evt.ready;
        timer = setTimeout(() => { if (ready) { ready(); ready = null; } }, 2000);
      }
    });
  }, []);

  const answerOptions = useCallback((stream: MediaStream) => ({
    mediaStream: stream,
    rtcAnswerConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
    pcConfig: {
      iceServers: [
        ...iceRef.current,
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      bundlePolicy: "max-bundle" as RTCBundlePolicy,
      rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
      iceCandidatePoolSize: 4,
      iceTransportPolicy: "all" as RTCIceTransportPolicy,
    },
  }), []);

  const primeMic = useCallback(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch(() => {});
  }, []);

  const stopPoll = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);

  const cleanup = useCallback(() => {
    stopTimer(); stopPoll();
    setCallState("none"); setMuted(false); setHeld(false); setSeconds(0);
    sessionRef.current = null; pendingOutRef.current = false;
    amiOutRef.current = false; callIdRef.current = null;
  }, [stopTimer, stopPoll]);

  const watchRemoteAnswer = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const id = callIdRef.current;
      if (!id) return;
      try {
        const r = await fetch(`/api/telephony/call-status?id=${id}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (j.answered) { stopPoll(); setCallState("active"); startTimer(); }
        else if (j.ended) { stopPoll(); }
      } catch { }
    }, 1500);
  }, [stopPoll, startTimer]);

  const wire = useCallback((session: any) => {
    const attachTrack = (pc: RTCPeerConnection) => {
      pc.addEventListener("track", (ev: RTCTrackEvent) => {
        if (audioRef.current && ev.streams?.[0]) {
          audioRef.current.srcObject = ev.streams[0];
          audioRef.current.play().catch(() => {});
        }
      });
    };
    session.on("peerconnection", (e: any) => attachTrack(e.peerconnection));
    if (session.connection) attachTrack(session.connection);

    let connectedOnce = false;
    const onConnected = () => {
      if (connectedOnce) return;
      connectedOnce = true;
      if (amiOutRef.current) {
        setCallState("outgoing");
        const pc: RTCPeerConnection | undefined = sessionRef.current?.connection;
        const recv = pc?.getReceivers?.().find((r) => r.track?.kind === "audio");
        if (recv?.track && audioRef.current && !audioRef.current.srcObject) {
          audioRef.current.srcObject = new MediaStream([recv.track]);
          audioRef.current.play().catch(() => {});
        }
        watchRemoteAnswer();
      } else {
        setCallState("active");
        startTimer();
      }
    };
    session.on("accepted", onConnected);
    session.on("confirmed", onConnected);
    session.on("ended", cleanup);
    session.on("failed", (e: any) => {
      const c = String(e?.cause || e?.message || "");
      const m = causeText(c, locale);
      if (m) { setInfo(!isRealError(c)); setErr(m); }
      cleanup();
    });
  }, [cleanup, startTimer, locale]);

  const [uaEpoch, setUaEpoch] = useState(0);
  const wsUrlRef = useRef<string | null>(null);
  const reviveRef = useRef<(() => void) | null>(null);
  const refetchingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/telephony/webrtc-config", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) {
            setStatus("connecting");
            setTimeout(() => { if (!cancelled) setUaEpoch((n) => n + 1); }, 15_000);
            return;
          }
          setStatus("disabled");
          return;
        }
        const cfg = await res.json();
        setExt(cfg.extension || "");
        const wsUrl = location.protocol === "https:" ? cfg.wssUrl : (cfg.wsUrl || cfg.wssUrl);
        if (!wsUrl || !cfg.domain) { setStatus("disabled"); return; }
        wsUrlRef.current = wsUrl;
        const ice: any[] = [];
        if (cfg.stunServer) ice.push(cfg.stunServer);
        if (cfg.turnServer) { ice.push(cfg.turnServer); ice.push({ ...cfg.turnServer, urls: cfg.turnServer.urls + "?transport=tcp" }); }
        iceRef.current = ice;

        const mod: any = await import("jssip");
        const JsSIP = mod.default ?? mod;
        if (cancelled) return;
        const socket = new JsSIP.WebSocketInterface(wsUrl);
        const ua = new JsSIP.UA({
          sockets: [socket],
          uri: `sip:${cfg.extension}@${cfg.domain}`,
          password: cfg.password,
          display_name: cfg.extension,
          register: true,
          register_expires: 60,
          session_timers: false,
        });
        uaRef.current = ua;
        setStatus("connecting");
        ua.on("registered", () => { setStatus("registered"); primeMic(); });
        ua.on("unregistered", () => setStatus("connecting"));
        ua.on("registrationFailed", () => {
          setStatus("failed");
          setTimeout(() => { try { if (!cancelled && ua.isConnected() && !ua.isRegistered()) ua.register(); } catch {} }, 5000);
        });
        ua.on("disconnected", () => {
          setStatus("failed");
          if (refetchingRef.current) return;
          refetchingRef.current = true;
          setTimeout(async () => {
            try {
              const r = await fetch("/api/telephony/webrtc-config", { cache: "no-store" });
              if (r.ok) {
                const c = await r.json();
                const fresh = location.protocol === "https:" ? c.wssUrl : (c.wsUrl || c.wssUrl);
                if (fresh && fresh !== wsUrlRef.current) setUaEpoch((n) => n + 1);
              }
            } catch { }
            finally { refetchingRef.current = false; }
          }, 4000);
        });
        ua.on("newRTCSession", (e: any) => {
          if (e.originator !== "remote") return;
          const session = e.session;
          sessionRef.current = session;
          if (!pendingOutRef.current) {
            const ruser = session.remote_identity?.uri?.user || "";
            const rname = session.remote_identity?.display_name || "";
            setPeer(rname && rname !== ruser ? rname : "");
            setPeerNumber(ruser);
          }
          if (pendingOutRef.current) {
            pendingOutRef.current = false;
            setCallState("outgoing");
            wire(session);
            forceIceTimeout(session);
            getStream()
              .then((stream) => {
                try {
                  session.answer(answerOptions(stream));
                } catch (e: unknown) {
                  const m = e instanceof Error ? e.message : String(e);
                  setErr(tr(locale, { uz: "Javob berish xatosi: ", ru: "Ошибка ответа: ", en: "Answer error: ", de: "Antwortfehler: " }) + m);
                  try { session.terminate(); } catch {}
                  cleanup();
                }
              })
              .catch((e: unknown) => {
                const m = e instanceof Error ? e.message : String(e);
                setErr(tr(locale, { uz: "Mikrofon xatosi: ", ru: "Ошибка микрофона: ", en: "Microphone error: ", de: "Mikrofonfehler: " }) + m);
                try { session.terminate(); } catch {}
                cleanup();
              });
            return;
          } else {
            setErr(null);
            setInfo(false);
            setCallState("incoming");
            setOpen(true);
          }
          wire(session);
        });
        ua.start();
        kaRef.current = setInterval(() => { try { if (ua.isConnected()) ua.register(); } catch {} }, 25000);
        const revive = () => {
          if (cancelled || document.visibilityState === "hidden") return;
          try {
            if (ua.isRegistered()) return;
            if (ua.isConnected()) ua.register();
            else setUaEpoch((n) => n + 1);
          } catch { setUaEpoch((n) => n + 1); }
        };
        document.addEventListener("visibilitychange", revive);
        window.addEventListener("online", revive);
        window.addEventListener("focus", revive);
        reviveRef.current = () => {
          document.removeEventListener("visibilitychange", revive);
          window.removeEventListener("online", revive);
          window.removeEventListener("focus", revive);
        };
      } catch {
        setStatus("disabled");
      }
    })();
    return () => {
      cancelled = true;
      if (kaRef.current) clearInterval(kaRef.current);
      reviveRef.current?.(); reviveRef.current = null;
      try { uaRef.current?.stop(); } catch {}
    };
  }, [wire, uaEpoch]);

  const startCall = useCallback(async (number?: string, leadId?: string, contactName?: string) => {
    const num = (number ?? dial).replace(/\s/g, "");
    if (!num) return;
    setErr(null); setInfo(false);
    setPeer(contactName || ""); setPeerNumber(num);
    pendingOutRef.current = true; amiOutRef.current = true;
    setCallState("outgoing"); setOpen(true);
    const res = await fetch("/api/telephony/originate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: num, leadId, contactName }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      callIdRef.current = j.callId ?? null;
    } else {
      setErr(j.message || tr(locale, { uz: "Qo'ng'iroq amalga oshmadi", ru: "Звонок не удался", en: "Call failed", de: "Anruf fehlgeschlagen" }));
      pendingOutRef.current = false; amiOutRef.current = false; setCallState("none");
    }
  }, [dial, locale]);

  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail || {}; startCall(d.number, d.leadId, d.contactName); };
    window.addEventListener("glive:call", h);
    return () => window.removeEventListener("glive:call", h);
  }, [startCall]);

  const loadHistory = useCallback((q: string, view: HistView) => {
    setHistLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (view === "missed") p.set("view", "missed");
    fetch(`/api/telephony/my-calls${p.toString() ? `?${p}` : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { calls: [] }))
      .then((j) => { setCalls(j.calls ?? []); setMissedPending(j.pending ?? 0); })
      .catch(() => setCalls([]))
      .finally(() => setHistLoading(false));
  }, []);

  useEffect(() => {
    if (!open || tab !== "history") return;
    const t = setTimeout(() => loadHistory(histQ, histView), histQ ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, tab, histQ, histView, loadHistory]);

  const markDone = async (id: string) => {
    setCalls((cs) => cs?.map((c) => (c.id === id ? { ...c, callbackStatus: "CALLED_BACK" } : c)) ?? cs);
    setMissedPending((n) => Math.max(0, n - 1));
    const r = await markCalledBack(id).catch(() => ({ error: "failed" }));
    if ("error" in r && r.error) loadHistory(histQ, histView);
  };

  const answer = async () => {
    const s = sessionRef.current;
    if (!s) return;
    forceIceTimeout(s);
    const stream = await getStream();
    try { s.answer(answerOptions(stream)); setCallState("active"); startTimer(); }
    catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(tr(locale, { uz: "Javob berish xatosi: ", ru: "Ошибка ответа: ", en: "Answer error: ", de: "Antwortfehler: " }) + m);
      try { s.terminate(); } catch {} cleanup();
    }
  };
  const hangup = () => { try { sessionRef.current?.terminate(); } catch {} cleanup(); };
  const toggleMute = () => { const s = sessionRef.current; if (!s) return; const on = !muted; try { s.connection.getSenders().forEach((snd: any) => { if (snd.track) snd.track.enabled = !on; }); } catch {} setMuted(on); };
  const toggleHold = () => { const s = sessionRef.current; if (!s) return; try { held ? s.unhold() : s.hold(); } catch {} setHeld(!held); };
  const press = (d: string) => { const s = sessionRef.current; if (callState === "active" && s) { try { s.sendDTMF(d, { duration: 100, interToneGap: 70 }); } catch {} } else setDial((v) => (v + d).slice(0, 15)); };

  useEffect(() => {
    const busy = callState === "active" || callState === "outgoing" || callState === "incoming";
    if (!open || tab !== "dial" || busy || status === "disabled") return;
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const activeTag = (activeEl?.tagName || "").toLowerCase();
      if ((activeTag === "input" || activeTag === "textarea") && activeEl !== dialInputRef.current) return;
      if (/^[0-9*#]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); setDial((v) => v.slice(0, -1)); }
      else if (e.key === "Enter") { e.preventDefault(); startCall(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tab, callState, status, startCall]);

  if (!mounted) return null;

  const dot = status === "registered" ? "bg-emerald-400" : status === "failed" ? "bg-rose-400" : status === "disabled" ? "bg-slate-400" : "bg-amber-400";
  const statusText = tr(locale, {
    uz: status === "registered" ? "Ulangan" : status === "failed" ? "Ulanmadi" : status === "disabled" ? "Sozlanmagan" : "Ulanmoqda...",
    ru: status === "registered" ? "Подключено" : status === "failed" ? "Ошибка" : status === "disabled" ? "Не настроено" : "Подключение...",
    en: status === "registered" ? "Connected" : status === "failed" ? "Failed" : status === "disabled" ? "Not configured" : "Connecting...",
    de: status === "registered" ? "Verbunden" : status === "failed" ? "Fehlgeschlagen" : status === "disabled" ? "Nicht konfiguriert" : "Verbinden...",
  });
  const inCall = callState === "active" || callState === "outgoing" || callState === "incoming";
  const footerCaption = [ext || "—", "WebRTC", statusText].join(" • ");

  return createPortal(
    <>
      <audio ref={audioRef} autoPlay className="hidden" />
      <button
        ref={launcherRef}
        onMouseDown={beginDrag("launcher")}
        style={launcherPos ? { left: launcherPos.x, top: launcherPos.y, right: "auto", bottom: "auto" } : undefined}
        className="fixed bottom-6 right-6 z-[70] grid h-14 w-14 cursor-move place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pop transition hover:scale-105"
        title="Telefon"
      >
        <Icon name="phone" className="h-6 w-6" />
        <span className={cn("absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white", dot, inCall && "animate-pulse")} />
      </button>

      {open && !inCall && (
        <div
          ref={panelRef}
          style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
          className="fixed bottom-24 right-6 z-[70] w-[336px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1b2e] shadow-pop"
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3.5">
            <div onMouseDown={beginDrag("panel")} className="flex flex-1 cursor-move items-center gap-2 select-none">
              <Icon name="phone" className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</span>
              <span className={cn("h-2 w-2 rounded-full bg-white/90", inCall && "animate-pulse")} />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="grid h-6 w-6 place-items-center rounded-md text-white/80 transition hover:bg-white/15 hover:text-white" title={tr(locale, { uz: "Kichraytirish", ru: "Свернуть", en: "Minimize", de: "Minimieren" })}>
                <Icon name="minimize" className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="grid h-6 w-6 place-items-center rounded-md text-white/80 transition hover:bg-white/15 hover:text-white">
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {status !== "disabled" && !inCall && (
            <div className="flex border-b border-white/10 px-1">
              <TabBtn active={tab === "dial"} onClick={() => setTab("dial")}>
                <span className="w-3.5 text-center text-[13px] font-bold leading-none">#</span>
                {tr(locale, { uz: "Raqam terish", ru: "Набор номера", en: "Dial number", de: "Nummer wählen" })}
              </TabBtn>
              <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
                <Icon name="history" className="h-3.5 w-3.5" />
                {tr(locale, { uz: "Tarix", ru: "История", en: "History", de: "Verlauf" })}
              </TabBtn>
            </div>
          )}

          <div className="min-h-[360px] p-4">
            {status === "disabled" ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/5 text-slate-400"><Icon name="phoneOff" className="h-6 w-6" /></div>
                <p className="text-sm font-medium text-slate-200">{tr(locale, { uz: "Telefoniya hali sozlanmagan", ru: "Телефония ещё не настроена", en: "Telephony not configured yet", de: "Telefonie noch nicht eingerichtet" })}</p>
                {canConfigure ? (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{tr(locale, { uz: "Qo'ng'iroqlar uchun Asterisk/WebRTC serverini Sozlamalardan ulang.", ru: "Для звонков подключите Asterisk/WebRTC в настройках.", en: "Connect Asterisk/WebRTC in settings to make calls.", de: "Verbinden Sie Asterisk/WebRTC in den Einstellungen, um Anrufe zu tätigen." })}</p>
                    <a href="/settings/telephony" className="mt-3 inline-block rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90">{tr(locale, { uz: "Telefoniya sozlamalari", ru: "Настройки телефонии", en: "Telephony settings", de: "Telefonie-Einstellungen" })}</a>
                  </>
                ) : (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{tr(locale, {
                    uz: "Sizga SIP raqami biriktirilmagan. Administrator yoki ROP'ga murojaat qiling.",
                    ru: "Вам не назначен SIP-номер. Обратитесь к администратору или РОПу.",
                    en: "No SIP extension assigned to you. Contact your administrator or ROP.",
                    de: "Ihnen ist keine SIP-Nebenstelle zugewiesen. Wenden Sie sich an Ihren Administrator oder ROP.",
                  })}</p>
                )}
              </div>
            ) : tab === "history" ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
                  {(["mine", "missed"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => { if (v !== histView) { setCalls(null); setHistView(v); } }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition",
                        histView === v ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {v === "mine"
                        ? tr(locale, { uz: "Mening qo'ng'iroqlarim", ru: "Мои звонки", en: "My calls", de: "Meine Anrufe" })
                        : tr(locale, { uz: "Javobsizlar", ru: "Пропущенные", en: "Missed", de: "Verpasst" })}
                      {v === "missed" && missedPending > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">{missedPending}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="relative mb-3">
                  <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={histQ}
                    onChange={(e) => setHistQ(e.target.value)}
                    placeholder={tr(locale, { uz: "Qidirish...", ru: "Поиск...", en: "Search...", de: "Suchen..." })}
                    className="h-9 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/50"
                  />
                </div>
                {histLoading ? (
                  <div className="py-10 text-center text-xs text-slate-500">{tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading...", de: "Wird geladen..." })}</div>
                ) : !calls || calls.length === 0 ? (
                  <div className="py-10 text-center">
                    <Icon name="history" className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                    <p className="text-sm text-slate-500">{tr(locale, { uz: "Tarix bo'sh", ru: "История пуста", en: "History is empty", de: "Verlauf ist leer" })}</p>
                  </div>
                ) : (
                  <ul className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto">
                    {calls.map((c) => {
                      const ok = c.status === "ANSWERED";
                      const pending = histView === "missed" && c.callbackStatus === "PENDING";
                      const calledBack = histView === "missed" && c.callbackStatus === "CALLED_BACK";
                      return (
                        <li key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/5">
                          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", ok ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
                            <Icon name={ok ? "phoneCall" : "phoneOff"} className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-100">{c.contactName || c.phone}</span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {fmtWhen(c.startedAt)}{ok && c.duration ? ` · ${fmtDur(c.duration)}` : ""}
                              {histView === "missed" && c.operatorName ? ` · ${c.operatorName}` : ""}
                              {calledBack && <span className="text-emerald-400"> · {tr(locale, { uz: "qayta qo'ng'iroq qilingan", ru: "перезвонили", en: "called back", de: "zurückgerufen" })}</span>}
                            </span>
                          </span>
                          {pending && (
                            <button onClick={() => markDone(c.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-emerald-500/15 hover:text-emerald-400" title={tr(locale, { uz: "Qayta qo'ng'iroq qilindi deb belgilash", ru: "Отметить как перезвонили", en: "Mark as called back", de: "Als zurückgerufen markieren" })}>
                              <Icon name="check" className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => startCall(c.phone, undefined, c.contactName || undefined)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-emerald-500/15 hover:text-emerald-400" title={tr(locale, { uz: "Qayta qo'ng'iroq", ru: "Перезвонить", en: "Call again", de: "Erneut anrufen" })}>
                            <Icon name="phone" className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <>
                <input
                  ref={dialInputRef}
                  autoFocus
                  value={dial}
                  onChange={(e) => setDial(e.target.value.replace(/[^\d+]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); startCall(); } }}
                  placeholder={tr(locale, { uz: "Raqam kiriting", ru: "Введите номер", en: "Enter number", de: "Nummer eingeben" })}
                  className="mb-3 h-11 w-full border-b border-white/10 bg-transparent text-center text-xl font-semibold tracking-wide text-white outline-none placeholder:text-base placeholder:font-medium placeholder:text-slate-600"
                />
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                    <button key={k} onClick={() => press(k)} className="grid h-12 place-items-center rounded-2xl bg-white/[0.06] text-lg font-semibold text-slate-100 transition hover:bg-white/[0.12] active:scale-95">{k}</button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => setDial((v) => v.slice(0, -1))} disabled={!dial} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-slate-300 transition hover:bg-white/[0.12] disabled:opacity-30">
                    <Icon name="backspace" className="h-4 w-4" />
                  </button>
                  <button onClick={() => startCall()} disabled={!dial} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40">
                    <Icon name="phoneCall" className="h-4 w-4" /> {tr(locale, { uz: "Qo'ng'iroq", ru: "Позвонить", en: "Call", de: "Anrufen" })}
                  </button>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.04] text-slate-700">
                    <Icon name="phoneOff" className="h-4 w-4" />
                  </span>
                </div>
              </>
            )}
            {err && <p className={cn("mt-3 rounded-lg px-3 py-2 text-xs", info ? "bg-white/[0.06] text-slate-300" : "bg-rose-500/10 text-rose-300")}>{err}</p>}
          </div>

          {status !== "disabled" && (
            <div className="border-t border-white/10 px-4 py-2.5 text-center text-[11px] text-slate-500">{footerCaption}</div>
          )}
        </div>
      )}

      {inCall && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-[2px] sm:p-6">
          <div className="animate-slide-up w-[320px] max-w-full rounded-3xl bg-[#1b2638] px-6 py-6 text-center shadow-pop ring-1 ring-white/10">
            <div className="relative mx-auto h-20 w-20">
              {callState !== "active" && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/25" style={{ animationDuration: "1.6s" }} />
                  <span className="absolute -inset-2 animate-ping rounded-full bg-emerald-500/15" style={{ animationDuration: "1.6s", animationDelay: "0.4s" }} />
                </>
              )}
              <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <Icon name="user" className="h-10 w-10" strokeWidth={1.6} />
              </div>
            </div>

            <div className="mt-4 truncate text-[22px] font-bold tracking-wide text-white tabular-nums">
              {peerNumber || dial || peer || "—"}
            </div>
            {peer && peer !== peerNumber && (
              <div className="mt-0.5 truncate text-sm text-slate-400">{peer}</div>
            )}

            {callState === "active" ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-3xl font-bold tabular-nums text-emerald-400">{fmtDur(seconds)}</span>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400"
                    style={{ animationDelay: `${i * 0.16}s`, animationDuration: "1s" }} />
                ))}
              </div>
            )}

            <div className="mt-2.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              {callState === "incoming"
                ? tr(locale, { uz: "Kiruvchi qo'ng'iroq", ru: "Входящий звонок", en: "Incoming call", de: "Eingehender Anruf" })
                : callState === "outgoing"
                  ? tr(locale, { uz: "Chaqirilmoqda...", ru: "Вызов...", en: "Ringing...", de: "Klingelt..." })
                  : held
                    ? tr(locale, { uz: "Kutishda", ru: "На удержании", en: "On hold", de: "In der Warteschleife" })
                    : tr(locale, { uz: "Suhbat", ru: "Разговор", en: "In call", de: "Im Gespräch" })}
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              {callState === "incoming" ? (
                <>
                  <button onClick={hangup} title={tr(locale, { uz: "Rad etish", ru: "Отклонить", en: "Decline", de: "Ablehnen" })} className="grid h-16 w-16 place-items-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600 active:scale-95">
                    <Icon name="phoneOff" className="h-7 w-7" />
                  </button>
                  <button onClick={answer} title={tr(locale, { uz: "Javob berish", ru: "Ответить", en: "Answer", de: "Annehmen" })} className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 active:scale-95">
                    <Icon name="phoneCall" className="h-7 w-7" />
                  </button>
                </>
              ) : (
                <>
                  <RoundBtn active={muted} disabled={callState !== "active"} onClick={toggleMute} icon={muted ? "micOff" : "mic"} label={tr(locale, { uz: "Ovozsiz", ru: "Микрофон", en: "Mute", de: "Stumm" })} />
                  <button onClick={hangup} title={tr(locale, { uz: "Tugatish", ru: "Завершить", en: "Hang up", de: "Auflegen" })} className="grid h-16 w-16 place-items-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600 active:scale-95">
                    <Icon name="phoneOff" className="h-7 w-7" />
                  </button>
                  <RoundBtn active={held} disabled={callState !== "active"} onClick={toggleHold} icon="pause" label={tr(locale, { uz: "Kutish", ru: "Удержание", en: "Hold", de: "Halten" })} />
                </>
              )}
            </div>

            {err && <p className={cn("mt-5 rounded-lg px-3 py-2 text-xs", info ? "bg-white/[0.06] text-slate-300" : "bg-rose-500/10 text-rose-300")}>{err}</p>}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

function RoundBtn({ active, disabled, onClick, icon, label }: { active: boolean; disabled?: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "grid h-14 w-14 place-items-center rounded-full transition active:scale-95 disabled:opacity-40",
        active ? "bg-white text-slate-800" : "bg-white/10 text-slate-200 hover:bg-white/20"
      )}
    >
      <Icon name={icon} className="h-6 w-6" />
    </button>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[13px] font-medium transition",
        active ? "border-emerald-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
      )}
    >
      {children}
    </button>
  );
}
