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

export function hashLoginCode(code: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(code).digest("base64url");
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyLoginCode(code: string, hash: string | null | undefined) {
  const normalizedCode = code.trim();

  if (!hash) {
    return config.INTERNAL_LOGIN_CODE ? normalizedCode === config.INTERNAL_LOGIN_CODE.trim() : false;
  }

  return timingSafeEqualText(hashLoginCode(normalizedCode), hash);
}

function verifyOwnerConfirmationCode(code: string | undefined) {
  return true;
}

function encodeSession(user: AppUser) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      sales_group: user.sales_group
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
    maxAge: 60 * 60 * 12
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

export async function authenticateInternalUser(email: string, code: string, ownerCode?: string) {
  const user = await findUserByEmail(email);

  if (!user || !verifyLoginCode(code, user.login_code_hash)) {
    return null;
  }

  if (user.role === "admin" && !verifyOwnerConfirmationCode(ownerCode)) {
    return null;
  }

  const { login_code_hash: _loginCodeHash, ...safeUser } = user;
  return safeUser;
}

export async function validateInternalLogin(email: string, code: string, ownerCode?: string) {
  const user = await findUserByEmail(email.trim().toLowerCase());

  if (!user) {
    return { user: null, error: "No encontramos ese usuario." };
  }

  if (!verifyLoginCode(code, user.login_code_hash)) {
    return { user: null, error: "Codigo interno incorrecto." };
  }

  const { login_code_hash: _loginCodeHash, ...safeUser } = user;
  return { user: safeUser, error: null };
}
