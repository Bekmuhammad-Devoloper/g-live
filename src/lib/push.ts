import "server-only";
import { readFile } from "node:fs/promises";
import { importPKCS8, SignJWT } from "jose";
import { prisma } from "./db";

// Push bildirishnoma — Firebase Cloud Messaging (FCM HTTP v1).
//
// SOZLANMAGAN BO'LSA JIM TURADI. Xizmat hisobi berilmagan bo'lsa hamma
// funksiya darhol qaytadi va hech qanday xato chiqarmaydi: ilovaning
// qolgan qismi push'siz ham to'liq ishlashi kerak, chunki bildirishnoma
// baribir bazaga yoziladi va o'quvchi uni ilova ichida ko'radi.
//
// SOZLASH (bir marta):
//   1. Firebase konsolida loyiha ochiladi va Android ilova qo'shiladi
//      (paket nomi: live.germaniya.app)
//   2. google-services.json → android/app/google-services.json
//   3. Project settings → Service accounts → "Generate new private key"
//      natijadagi JSON → serverga, masalan /opt/gl-edu/fcm-service.json
//   4. .env ga:  FCM_SERVICE_ACCOUNT_FILE=/opt/gl-edu/fcm-service.json
//
// Xizmat hisobi fayli MAXFIY: u bilan bizning nomimizdan istalgan
// bildirishnoma yuborish mumkin. Gitga tushmasin, jurnalga chiqmasin.

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let accountPromise: Promise<ServiceAccount | null> | undefined;

/** Xizmat hisobini o'qiydi (bir marta, keyin xotiradan) */
function serviceAccount(): Promise<ServiceAccount | null> {
  accountPromise ??= (async () => {
    // Ikki xil berish mumkin: to'g'ridan-to'g'ri JSON matni yoki fayl yo'li.
    // Fayl afzal — .env ichida ko'p qatorli maxfiy kalit chalkashlik tug'diradi.
    const inline = process.env.FCM_SERVICE_ACCOUNT?.trim();
    const path = process.env.FCM_SERVICE_ACCOUNT_FILE?.trim();

    let raw: string | undefined;
    if (inline) raw = inline;
    else if (path) {
      try {
        raw = await readFile(path, "utf8");
      } catch {
        console.warn("[push] xizmat hisobi fayli o'qilmadi:", path);
        return null;
      }
    }
    if (!raw) return null;

    try {
      const a = JSON.parse(raw) as Partial<ServiceAccount>;
      if (!a.project_id || !a.client_email || !a.private_key) {
        console.warn("[push] xizmat hisobida project_id/client_email/private_key yo'q");
        return null;
      }
      return { project_id: a.project_id, client_email: a.client_email, private_key: a.private_key };
    } catch {
      console.warn("[push] xizmat hisobi JSON emas");
      return null;
    }
  })();
  return accountPromise;
}

export async function isPushConfigured(): Promise<boolean> {
  return (await serviceAccount()) !== null;
}

// ── Kirish tokeni ──
// Google bergan token 1 soat yashaydi. Har yuborishda yangisini so'rash —
// keraksiz kechikish va so'rovlar chegarasi, shu sabab xotirada saqlaymiz.
let cached: { token: string; expiresAt: number } | undefined;

async function accessToken(acc: ServiceAccount): Promise<string | null> {
  const now = Date.now();
  // 60 soniya zaxira: so'rov yo'lda ekan token eskirib qolmasin
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  try {
    const key = await importPKCS8(acc.private_key.replace(/\\n/g, "\n"), "RS256");
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(acc.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) {
      console.warn("[push] kirish tokeni olinmadi:", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;

    cached = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 };
    return cached.token;
  } catch (e) {
    console.warn("[push] kirish tokeni xatosi:", e);
    return null;
  }
}

export interface PushPayload {
  title: string;
  body?: string;
  /** Bosilganda ochiladigan sahifa, masalan "/student/mitteilungen" */
  url?: string;
}

/**
 * Bitta odamning BARCHA qurilmalariga yuboradi.
 *
 * Hech qachon xato ko'tarmaydi: push yuborilmagani uchun uni chaqirgan
 * amal (masalan baho qo'yish) bekor bo'lib qolmasligi kerak.
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  const acc = await serviceAccount();
  if (!acc) return 0;

  const devices = await prisma.pushDevice.findMany({
    where: { userId },
    select: { id: true, token: true },
  });
  if (devices.length === 0) return 0;

  const token = await accessToken(acc);
  if (!token) return 0;

  const url = `https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`;
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    devices.map(async (d) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token: d.token,
              notification: { title: payload.title, body: payload.body ?? "" },
              // Ilova ochilganda qaysi sahifaga o'tishni shu yerdan biladi
              data: payload.url ? { url: payload.url } : undefined,
              android: {
                priority: "HIGH",
                notification: {
                  channel_id: "germaniya_live",
                  icon: "ic_stat_notify",
                  color: "#0e7490",
                  default_sound: true,
                },
              },
            },
          }),
        });

        if (res.ok) {
          sent++;
          return;
        }

        // 404 UNREGISTERED yoki 400 INVALID_ARGUMENT — token endi yaroqsiz.
        // Ilova o'chirilgan yoki ma'lumotlari tozalangan: yozuvni olib
        // tashlaymiz, aks holda har safar behuda so'rov ketaveradi.
        if (res.status === 404 || res.status === 400) {
          dead.push(d.id);
        } else {
          console.warn("[push] yuborilmadi:", res.status);
        }
      } catch (e) {
        console.warn("[push] tarmoq xatosi:", e);
      }
    }),
  );

  if (dead.length > 0) {
    await prisma.pushDevice.deleteMany({ where: { id: { in: dead } } }).catch(() => {});
  }
  return sent;
}

/** Bir nechta odamga (masalan guruhdagi hamma o'quvchiga) */
export async function sendPushMany(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  if (!(await isPushConfigured())) return;

  // Ketma-ket emas, lekin cheksiz parallel ham emas: bir vaqtda 20 tadan.
  // Butun guruhga yuborilganda Firebase ni ham, serverni ham bosmaslik uchun.
  const BATCH = 20;
  for (let i = 0; i < unique.length; i += BATCH) {
    await Promise.all(unique.slice(i, i + BATCH).map((id) => sendPush(id, payload)));
  }
}
