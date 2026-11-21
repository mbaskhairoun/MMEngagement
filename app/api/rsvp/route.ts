import { getGuest } from "@/lib/data/guests";
import { getRsvpByGuest, upsertRsvp } from "@/lib/data/rsvps";
import { getFormConfig } from "@/lib/data/settings";
import { badRequest, locked, notFound, ok, readJson, route } from "@/lib/http";
import { sendRsvpConfirmation } from "@/lib/mail";
import { applyRsvpRules } from "@/lib/rsvp-rules";
import { rsvpSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const guestId = uuidSchema.safeParse(req.nextUrl.searchParams.get("guestId"));
  if (!guestId.success) return badRequest("invalid_guest_id");
  return ok({ rsvp: await getRsvpByGuest(guestId.data) });
});

export const POST = route(async (req) => {
  const body = await readJson(req, rsvpSchema);
  if (body.response) return body.response;
  if ((await getFormConfig()).rsvpDisabled) return locked();

  const guest = await getGuest(body.data.guestId);
  if (!guest) return notFound("guest_not_found");

  const checked = applyRsvpRules(guest, body.data);
  if (checked.error) return badRequest(checked.error);

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const { rsvp, isUpdate } = await upsertRsvp(guest, checked.value, userAgent);

  let emailSent = false;
  try {
    const outcome = await sendRsvpConfirmation({ guest, rsvp, isUpdate });
    emailSent = !outcome.skipped && outcome.succeeded > 0;
  } catch (err) {
    console.error("[rsvp] confirmation email failed:", err);
  }

  return ok({ rsvpId: rsvp.id, isUpdate, emailSent });
});
