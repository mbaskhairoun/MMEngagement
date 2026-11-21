import { NextResponse, type NextRequest } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";

export type ValidationIssue = { path: string; message: string };

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: object, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function ok(body: object = {}, status = 200): NextResponse {
  return json({ ok: true, ...body }, status);
}

export function fail(
  status: number,
  error: string,
  extra: object = {},
  headers: Record<string, string> = {},
): NextResponse {
  return json({ ok: false, error, ...extra }, status, headers);
}

export const badRequest = (error = "bad_request", issues?: ValidationIssue[]) =>
  fail(400, error, issues ? { issues } : {});
export const unauthorized = () => fail(401, "unauthorized");
export const notFound = (error = "not_found") => fail(404, error);
export const conflict = (error = "conflict") => fail(409, error);
export const locked = (error = "rsvp_closed") => fail(423, error);
export const tooManyRequests = (retryAfterSeconds: number) =>
  fail(429, "too_many_requests", {}, { "Retry-After": String(retryAfterSeconds) });
export const serviceUnavailable = (error: string) => fail(503, error);
export const serverError = () => fail(500, "internal_error");

type Parsed<T> = { data: T; response?: undefined } | { data?: undefined; response: NextResponse };

export function parseWith<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };
  const issues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return { response: badRequest("invalid_body", issues) };
}

export async function readJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<Parsed<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: badRequest("invalid_json") };
  }
  return parseWith(schema, body);
}

export type RouteContext<P extends Record<string, string> = Record<string, never>> = { params: Promise<P> };

export type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      console.error(`[api] ${req.method} ${req.nextUrl.pathname} failed:`, err);
      return serverError();
    }
  };
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export function isForeignKeyViolation(err: unknown): err is { code: "23503"; constraint?: string } {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23503";
}
