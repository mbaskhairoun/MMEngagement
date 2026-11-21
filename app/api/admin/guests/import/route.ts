import { adminRoute } from "@/lib/auth";
import { importGuests } from "@/lib/data/guests";
import { ok, readJson } from "@/lib/http";
import { guestImportSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute(async (req) => {
  const body = await readJson(req, guestImportSchema);
  if (body.response) return body.response;
  return ok(await importGuests(body.data.mode, body.data.guests));
});
