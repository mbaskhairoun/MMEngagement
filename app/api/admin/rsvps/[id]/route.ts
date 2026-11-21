import { adminRoute } from "@/lib/auth";
import { deleteRsvp } from "@/lib/data/rsvps";
import { badRequest, notFound, ok, type RouteContext } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = adminRoute<RouteContext<{ id: string }>>(async (_req, { params }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return badRequest("invalid_id");
  return (await deleteRsvp(id.data)) ? ok() : notFound("rsvp_not_found");
});
