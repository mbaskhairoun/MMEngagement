import { getSyncInfo, listPins, listSections } from "@/lib/data/inspo";
import { decorRoute } from "@/lib/decor-auth";
import { ok, parseWith } from "@/lib/http";
import { inspoQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = decorRoute(async (req) => {
  const query = parseWith(inspoQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
  if (query.response) return query.response;
  const [sections, pins, sync] = await Promise.all([
    listSections(),
    listPins(query.data.includeRemoved),
    getSyncInfo(),
  ]);
  const syncSummary = sync
    ? { lastSyncedAt: sync.lastSyncedAt, pinCount: sync.pinCount, sectionCount: sync.sectionCount, source: sync.source }
    : null;
  return ok({ sections, pins, sync: syncSummary });
});
