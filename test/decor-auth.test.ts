import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, signSession, signToken, verifySession, verifyToken } from "@/lib/auth";
import { DECOR_COOKIE, decorRole, isCronRequest, requireDecor, setDecorCookie } from "@/lib/decor-auth";

const SECRET = "test-secret-at-least-16-chars";
const future = () => Date.now() / 1000 + 60;

const request = (cookies: Record<string, string> = {}, headers: Record<string, string> = {}) => {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest("http://localhost/api/decor/me", { headers: { ...(cookie ? { cookie } : {}), ...headers } });
};

describe("audience-scoped tokens", () => {
  it("never accepts a token minted for another audience", () => {
    const exp = 1_800_000_060;
    const decor = signToken(exp, SECRET, "decor");
    const admin = signToken(exp, SECRET, "admin");
    expect(verifyToken(decor, SECRET, "decor", exp - 60)).toBe(true);
    expect(verifyToken(decor, SECRET, "admin", exp - 60)).toBe(false);
    expect(verifyToken(admin, SECRET, "decor", exp - 60)).toBe(false);
  });

  it("keeps the admin token format unchanged (existing sessions stay valid)", () => {
    const exp = 1_800_000_060;
    expect(signSession(exp, SECRET)).toBe(signToken(exp, SECRET, "admin"));
    expect(verifySession(signToken(exp, SECRET, "admin"), SECRET, exp - 60)).toBe(true);
  });
});

describe("requireDecor", () => {
  beforeEach(() => vi.stubEnv("SESSION_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("rejects requests without a session", async () => {
    const denied = requireDecor(request());
    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({ ok: false, error: "unauthorized" });
  });

  it("accepts a valid mm_decor cookie with role decor", () => {
    const req = request({ [DECOR_COOKIE]: signToken(future(), SECRET, "decor") });
    expect(requireDecor(req)).toBeNull();
    expect(decorRole(req)).toBe("decor");
  });

  it("accepts a valid mm_admin cookie with role admin", () => {
    const req = request({ [SESSION_COOKIE]: signSession(future(), SECRET) });
    expect(requireDecor(req)).toBeNull();
    expect(decorRole(req)).toBe("admin");
  });

  it("rejects an admin token placed in the decor cookie, and expired or forged cookies", () => {
    expect(requireDecor(request({ [DECOR_COOKIE]: signSession(future(), SECRET) }))?.status).toBe(401);
    expect(requireDecor(request({ [DECOR_COOKIE]: signToken(Date.now() / 1000 - 1, SECRET, "decor") }))?.status).toBe(401);
    expect(requireDecor(request({ [DECOR_COOKIE]: signToken(future(), "another-secret-of-length", "decor") }))?.status).toBe(401);
  });

  it("a decor token does not grant admin access", async () => {
    const { requireAdmin } = await import("@/lib/auth");
    const token = signToken(future(), SECRET, "decor");
    expect(requireAdmin(request({ [SESSION_COOKIE]: token }))?.status).toBe(401);
    expect(requireAdmin(request({ [DECOR_COOKIE]: token }))?.status).toBe(401);
  });

  it("denies everything when SESSION_SECRET is missing", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(requireDecor(request({ [DECOR_COOKIE]: signToken(future(), "", "decor") }))?.status).toBe(401);
  });

  it("sets an httpOnly 7-day mm_decor cookie that verifies as decor", () => {
    const res = NextResponse.json({});
    setDecorCookie(res, SECRET);
    const cookie = res.cookies.get(DECOR_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBe(7 * 24 * 60 * 60);
    expect(verifyToken(cookie?.value, SECRET, "decor")).toBe(true);
  });
});

describe("isCronRequest", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only the exact CRON_SECRET bearer", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    expect(isCronRequest(request({}, { authorization: "Bearer cron-secret-value" }))).toBe(true);
    expect(isCronRequest(request({}, { authorization: "Bearer wrong" }))).toBe(false);
    expect(isCronRequest(request())).toBe(false);
  });

  it("is always false when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronRequest(request({}, { authorization: "Bearer " }))).toBe(false);
  });
});
