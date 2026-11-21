import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { passwordMatches, requireAdmin, SESSION_COOKIE, signSession, verifySession } from "@/lib/auth";
import { createRateLimiter } from "@/lib/rate-limit";

const SECRET = "test-secret-at-least-16-chars";
const now = 1_800_000_000;

describe("session tokens", () => {
  it("verifies a token it signed before expiry", () => {
    const token = signSession(now + 60, SECRET);
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/);
    expect(verifySession(token, SECRET, now)).toBe(true);
  });

  it("rejects expired, tampered, foreign or malformed tokens", () => {
    const token = signSession(now + 60, SECRET);
    expect(verifySession(token, SECRET, now + 61)).toBe(false);
    expect(verifySession(token.replace(/^\d+/, String(now + 999_999)), SECRET, now)).toBe(false);
    expect(verifySession(token, "another-secret-of-length", now)).toBe(false);
    expect(verifySession("garbage", SECRET, now)).toBe(false);
    expect(verifySession(undefined, SECRET, now)).toBe(false);
  });

  it("compares passwords", () => {
    expect(passwordMatches("hunter2", "hunter2")).toBe(true);
    expect(passwordMatches("hunter", "hunter2")).toBe(false);
  });
});

describe("requireAdmin", () => {
  afterEach(() => vi.unstubAllEnvs());

  const request = (cookie?: string) =>
    new NextRequest("http://localhost/api/admin/me", { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });

  it("returns 401 JSON without a valid cookie and null with one", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const denied = requireAdmin(request());
    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({ ok: false, error: "unauthorized" });
    expect(requireAdmin(request(signSession(Date.now() / 1000 + 60, SECRET)))).toBeNull();
  });

  it("denies everything when SESSION_SECRET is missing", () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(requireAdmin(request(signSession(Date.now() / 1000 + 60, "")))?.status).toBe(401);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit until the window passes", () => {
    const limiter = createRateLimiter(5, 1000);
    for (let i = 0; i < 5; i++) limiter.hit("ip", 0);
    expect(limiter.retryAfter("ip", 10)).toBe(1);
    expect(limiter.retryAfter("ip", 1000)).toBe(0);
    limiter.hit("other", 0);
    limiter.reset("other");
    expect(limiter.retryAfter("other", 0)).toBe(0);
  });
});
