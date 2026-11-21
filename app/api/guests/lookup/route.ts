import { listGuestsPublic } from "@/lib/data/guests";
import { getFormConfig } from "@/lib/data/settings";
import { matchGuests } from "@/lib/guest-match";
import { locked, ok, readJson, route } from "@/lib/http";
import { lookupSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const body = await readJson(req, lookupSchema);
  if (body.response) return body.response;
  if ((await getFormConfig()).rsvpDisabled) return locked();

  const result = matchGuests(await listGuestsPublic(), body.data.name);
  return ok({
    exact: result.exact,
    matchedName: result.matchedName,
    candidates: result.candidates.map(({ guest, matchedName }) => ({ guest, matchedName })),
  });
});
