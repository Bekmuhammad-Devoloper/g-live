import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ROLES, type Locale } from "./constants";
import { prisma } from "./db";
import { instanceBlockState, isDevPanel } from "./instance";

const COOKIE = "gl_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-CHANGE-ME"
);

export interface SessionUser {
  userId: string;
  role: string;
  fullName: string;
  locale: Locale;
  branchId: string | null;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  if (isDevPanel() || instanceBlockState().blocked) return null;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = String(payload.userId);
    let role = String(payload.role);

    if (role === ROLES.MANAGER) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (u && u.role !== ROLES.MANAGER) role = u.role;
    }

    return {
      userId,
      role,
      fullName: String(payload.fullName),
      locale: (payload.locale as Locale) ?? "uz",
      branchId: (payload.branchId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session as SessionUser;
}
