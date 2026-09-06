/**
 * Minimal admin auth — a single/small admin_users table (per plan section 5),
 * a signed session cookie (via `jose`), no separate auth service needed.
 * This is intentionally simple for MVP scale (one or a few reviewers).
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "change-this-in-.env"
);
const COOKIE_NAME = "admin_session";

export async function verifyCredentials(email: string, password: string) {
  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string };
  } catch {
    return null; // expired or invalid token
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}
