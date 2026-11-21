import { deleteSection, updateSection } from "@/lib/data/inspo";
import { decorRoute } from "@/lib/decor-auth";
import { badRequest, conflict, isUniqueViolation, notFound, ok, readJson, type RouteContext } from "@/lib/http";
import { sectionPatchSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<{ id: string }>;

export const PATCH = decorRoute<Ctx>(async (req, { params }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return badRequest("invalid_id");
  const body = await readJson(req, sectionPatchSchema);
  if (body.response) return body.response;
  try {
    const section = await updateSection(id.data, body.data);
    return section ? ok({ section }) : notFound("section_not_found");
  } catch (err) {
    if (isUniqueViolation(err)) return conflict("duplicate_section");
    throw err;
  }
});

export const DELETE = decorRoute<Ctx>(async (_req, { params }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return badRequest("invalid_id");
  const result = await deleteSection(id.data);
  if (result === "deleted") return ok();
  if (result === "not_found") return notFound("section_not_found");
  return conflict(result);
});
