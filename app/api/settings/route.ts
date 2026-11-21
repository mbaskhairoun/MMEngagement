import { wedding } from "@/content/wedding";
import { getFormConfig } from "@/lib/data/settings";
import { ok, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const config = await getFormConfig();
  return ok({ rsvpDisabled: config.rsvpDisabled, fields: config.fields, rsvpDeadline: wedding.rsvp.deadlineIso });
});
