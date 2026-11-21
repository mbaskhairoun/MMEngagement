import type { NextRequest } from "next/server";
import { isCronRequest, requireDecor } from "@/lib/decor-auth";
import { ok, parseWith, route, serviceUnavailable } from "@/lib/http";
import { dispatchFullSync, syncFromRss, SyncUnavailableError } from "@/lib/pinterest-sync";
import { syncQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest): Promise<Response> {
  if (!isCronRequest(req)) {
    const denied = requireDecor(req);
    if (denied) return denied;
  }
  const query = parseWith(syncQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
  if (query.response) return query.response;

  const full = query.data.full;
  if (full && (await dispatchFullSync())) return ok({ dispatched: true });

  try {
    const result = await syncFromRss();
    return ok(full ? { dispatched: false, ...result } : result);
  } catch (err) {
    if (err instanceof SyncUnavailableError) {
      console.error("[decor-sync]", err.message);
      return serviceUnavailable("sync_unavailable");
    }
    throw err;
  }
}

/** UI button (decor/admin cookie) or the Vercel cron (Bearer CRON_SECRET). */
export const POST = route(handle);

/** Vercel cron jobs call their path with GET; same auth and behaviour as POST. */
export const GET = route(handle);
