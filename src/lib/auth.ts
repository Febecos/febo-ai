import crypto from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config";
import { AppUser, findUserByEmail } from "./crm";

const cookieName = "febo_session";

function getAuthSecret() {
  if (!config.AUTH_SECRET) {
    throw new Error("Falta configurar AUTH_SECRET.");
  }

  return config.AUTH_SECRET;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function encodeSession(user: AppUser) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AppUser;
  } catch {
    return null;
  }
}

export async function createSession(user: AppUser) {
  const store = await cookies();
  store.set(cookieName, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(cookieName);
}

export async function getCurrentUser() {
  const store = await cookies();
  return decodeSession(store.get(cookieName)?.value);
}

export async function authenticateInternalUser(email: string, code: string) {
  if (!config.INTERNAL_LOGIN_CODE) {
    throw new Error("Falta configurar INTERNAL_LOGIN_CODE.");
  }

  if (code !== config.INTERNAL_LOGIN_CODE) {
    return null;
  }

  return findUserByEmail(email);
}
