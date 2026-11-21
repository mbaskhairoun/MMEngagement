import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

export function POST(): Response {
  const res = ok();
  clearSessionCookie(res);
  return res;
}
