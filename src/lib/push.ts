import "server-only";
import { readFile } from "node:fs/promises";
import { importPKCS8, SignJWT } from "jose";
import { prisma } from "./db";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let accountPromise: Promise<ServiceAccount | null> | undefined;

function serviceAccount(): Promise<ServiceAccount | null> {
  accountPromise ??= (async () => {
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

let cached: { token: string; expiresAt: number } | undefined;

async function accessToken(acc: ServiceAccount): Promise<string | null> {
  const now = Date.now();
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
  url?: string;
}

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

export async function sendPushMany(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  if (!(await isPushConfigured())) return;

  const BATCH = 20;
  for (let i = 0; i < unique.length; i += BATCH) {
    await Promise.all(unique.slice(i, i + BATCH).map((id) => sendPush(id, payload)));
  }
}
