import { createSection } from "@/lib/data/inspo";
import { decorRoute } from "@/lib/decor-auth";
import { conflict, isUniqueViolation, ok, readJson } from "@/lib/http";
import { sectionCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = decorRoute(async (req) => {
  const body = await readJson(req, sectionCreateSchema);
  if (body.response) return body.response;
  try {
    return ok({ section: await createSection(body.data.title) }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return conflict("duplicate_section");
    throw err;
  }
});
