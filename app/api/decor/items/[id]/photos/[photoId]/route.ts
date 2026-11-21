import { deleteBlobs } from "@/lib/blob";
import { deletePhoto } from "@/lib/data/decor";
import { decorRoute } from "@/lib/decor-auth";
import { badRequest, notFound, ok, type RouteContext } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<{ id: string; photoId: string }>;

export const DELETE = decorRoute<Ctx>(async (_req, { params }) => {
  const { id, photoId } = await params;
  const itemId = uuidSchema.safeParse(id);
  const photo = uuidSchema.safeParse(photoId);
  if (!itemId.success || !photo.success) return badRequest("invalid_id");
  const blob = await deletePhoto(itemId.data, photo.data);
  if (blob === null) return notFound("photo_not_found");
  await deleteBlobs([blob]);
  return ok();
});
