import { setPinSection } from "@/lib/data/inspo";
import { decorRoute } from "@/lib/decor-auth";
import { badRequest, isForeignKeyViolation, notFound, ok, readJson, type RouteContext } from "@/lib/http";
import { pinPatchSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<{ id: string }>;

export const PATCH = decorRoute<Ctx>(async (req, { params }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return badRequest("invalid_id");
  const body = await readJson(req, pinPatchSchema);
  if (body.response) return body.response;
  try {
    const pin = await setPinSection(id.data, body.data.sectionId);
    return pin ? ok({ pin }) : notFound("pin_not_found");
  } catch (err) {
    if (isForeignKeyViolation(err)) return notFound("section_not_found");
    throw err;
  }
});
