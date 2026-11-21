import { adminRoute } from "@/lib/auth";
import { createGuest, listGuestsAdmin } from "@/lib/data/guests";
import { conflict, isUniqueViolation, ok, readJson } from "@/lib/http";
import { guestInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok({ guests: await listGuestsAdmin() }));

export const POST = adminRoute(async (req) => {
  const body = await readJson(req, guestInputSchema);
  if (body.response) return body.response;
  try {
    return ok({ guest: await createGuest(body.data) }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return conflict("duplicate_invitation_name");
    throw err;
  }
});
