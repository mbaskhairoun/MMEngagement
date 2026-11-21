import { adminRoute } from "@/lib/auth";
import { deleteGuest, updateGuest } from "@/lib/data/guests";
import { badRequest, conflict, isUniqueViolation, notFound, ok, readJson, type RouteContext } from "@/lib/http";
import { guestInputSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<{ id: string }>;

export const PUT = adminRoute<Ctx>(async (req, { params }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return badRequest("invalid_id");
  const body = await readJson(req, guestInputSchema);
  if (body.response) return body.response;
  try {
    const guest = await updateGuest(id.data, body.data);
    return guest ? ok({ guest }) : notFound("guest_not_found");
  } catch (err) {
    if (isUniqueViolation(err)) return conflict("duplicate_invitation_name");
    throw err;
  }
});

export const DELETE = adminRoute<Ctx>(async (_req, { params }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return badRequest("invalid_id");
  return (await deleteGuest(id.data)) ? ok() : notFound("guest_not_found");
});
