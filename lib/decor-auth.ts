import { timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  clearCookie,
  hasValidCookie,
  isAdmin,
  passwordMatches,
  sessionSecret,
  setAudienceCookie,
} from "@/lib/auth";
import { route, unauthorized, type Handler } from "@/lib/http";

export const DECOR_COOKIE = "mm_decor";

export type DecorRole = "decor" | "admin";

export type DecorAuthConfig = { password: string; secret: string };

export function decorAuthConfig(): DecorAuthConfig | null {
  const password = process.env.DECOR_PASSWORD;
  const secret = sessionSecret();
  return password && secret ? { password, secret } : null;
}

export const decorPasswordMatches = passwordMatches;

export function setDecorCookie(res: NextResponse, secret: string): void {
  setAudienceCookie(res, DECOR_COOKIE, "decor", secret);
}

export function clearDecorCookie(res: NextResponse): void {
  clearCookie(res, DECOR_COOKIE);
}

/** Who is calling a decor route: a decorator (`mm_decor`) or the couple (`mm_admin`), else null. */
export function decorRole(req: NextRequest): DecorRole | null {
  if (hasValidCookie(req, DECOR_COOKIE, "decor")) return "decor";
  if (isAdmin(req)) return "admin";
  return null;
}

/** Returns a 401 JSON response unless the request has a valid decor OR admin session, otherwise null. */
export function requireDecor(req: NextRequest): NextResponse | null {
  return decorRole(req) ? null : unauthorized();
}

/** Wraps a decor route handler: 401 unless authenticated (decor or admin), thrown errors become 500. */
export function decorRoute<C>(handler: Handler<C>): Handler<C> {
  return route<C>(async (req, ctx) => requireDecor(req) ?? handler(req, ctx));
}

/** True when the request carries `Authorization: Bearer ${CRON_SECRET}` (Vercel cron). */
export function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
