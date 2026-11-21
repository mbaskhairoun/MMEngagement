import { isBlobUrl } from "@/lib/blob";
import { addPhoto } from "@/lib/data/decor";
import { decorRoute } from "@/lib/decor-auth";
import { badRequest, conflict, notFound, ok, readJson, type RouteContext } from "@/lib/http";
import { photoCreateSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<{ id: string }>;

export const POST = decorRoute<Ctx>(async (req, { params }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return badRequest("invalid_id");
  const body = await readJson(req, photoCreateSchema);
  if (body.response) return body.response;
  const { url, pathname } = body.data;
  if (!isBlobUrl(url)) return badRequest("invalid_photo_url");
  if (!pathname.startsWith(`decor/${id.data}/`) || decodeURIComponent(new URL(url).pathname) !== `/${pathname}`) {
    return badRequest("invalid_photo_pathname");
  }
  const result = await addPhoto(id.data, body.data);
  if ("photo" in result) return ok({ photo: result.photo }, 201);
  return result.error === "item_not_found" ? notFound("item_not_found") : conflict("too_many_photos");
});
