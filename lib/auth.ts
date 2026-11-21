import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { route, unauthorized, type Handler } from "@/lib/http";

export const SESSION_COOKIE = "mm_admin";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 16;

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/**
 * Session audiences. The admin audience signs the bare expiry (the original
 * format, so existing admin sessions stay valid); any other audience is mixed
 * into the MAC so a token minted for one area never verifies for another.
 */
export type Audience = "admin" | "decor";

const macInput = (audience: Audience, exp: string) => (audience === "admin" ? exp : `${audience}:${exp}`);

/** Token format: `<expiry unix seconds>.<base64url HMAC-SHA256(secret, [audience:]expiry)>`. */
export function signToken(expiresAt: number, secret: string, audience: Audience): string {
  const exp = String(Math.floor(expiresAt));
  return `${exp}.${hmac(secret, macInput(audience, exp)).toString("base64url")}`;
}

export function verifyToken(
  token: string | undefined,
  secret: string,
  audience: Audience,
  nowSeconds = Date.now() / 1000,
): boolean {
  if (!token) return false;
  const match = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const [, exp, signature] = match;
  const expected = hmac(secret, macInput(audience, exp));
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return Number(exp) > nowSeconds;
}

export const signSession = (expiresAt: number, secret: string): string => signToken(expiresAt, secret, "admin");

export const verifySession = (token: string | undefined, secret: string, nowSeconds = Date.now() / 1000): boolean =>
  verifyToken(token, secret, "admin", nowSeconds);

/** Constant-time comparison: both sides are hashed to equal-length digests first. */
export function passwordMatches(input: string, expected: string): boolean {
  const key = "mm-admin-password";
  return timingSafeEqual(hmac(key, input), hmac(key, expected));
}

export type AuthConfig = { password: string; secret: string };

export function authConfig(): AuthConfig | null {
  const password = process.env.ADMIN_PASSWORD;
  const secret = sessionSecret();
  return password && secret ? { password, secret } : null;
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** Sets a signed session cookie for `audience` that expires after `SESSION_TTL_SECONDS`. */
export function setAudienceCookie(res: NextResponse, name: string, audience: Audience, secret: string): void {
  const exp = Date.now() / 1000 + SESSION_TTL_SECONDS;
  res.cookies.set(name, signToken(exp, secret, audience), cookieOptions(SESSION_TTL_SECONDS));
}

export function clearCookie(res: NextResponse, name: string): void {
  res.cookies.set(name, "", cookieOptions(0));
}

/** True when the request carries a valid, unexpired `name` cookie for `audience`. */
export function hasValidCookie(req: NextRequest, name: string, audience: Audience): boolean {
  const secret = sessionSecret();
  return secret !== null && verifyToken(req.cookies.get(name)?.value, secret, audience);
}

export function setSessionCookie(res: NextResponse, secret: string): void {
  setAudienceCookie(res, SESSION_COOKIE, "admin", secret);
}

export function clearSessionCookie(res: NextResponse): void {
  clearCookie(res, SESSION_COOKIE);
}

export function isAdmin(req: NextRequest): boolean {
  return hasValidCookie(req, SESSION_COOKIE, "admin");
}

/** Returns a 401 JSON response when the request lacks a valid admin session, otherwise null. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  return isAdmin(req) ? null : unauthorized();
}

/** Wraps an admin route handler: rejects with 401 unless authenticated, and maps thrown errors to 500. */
export function adminRoute<C>(handler: Handler<C>): Handler<C> {
  return route<C>(async (req, ctx) => requireAdmin(req) ?? handler(req, ctx));
}
