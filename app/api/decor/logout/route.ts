import { clearDecorCookie } from "@/lib/decor-auth";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clears only the decor cookie; an admin session (if any) is left alone. */
export function POST(): Response {
  const res = ok();
  clearDecorCookie(res);
  return res;
}
