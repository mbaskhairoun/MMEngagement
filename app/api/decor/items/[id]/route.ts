import { deleteBlobs } from "@/lib/blob";
import { deleteItem, getItem, itemReferenceError, replaceItem, setItemStatus } from "@/lib/data/decor";
import { decorRoute } from "@/lib/decor-auth";
import { badRequest, notFound, ok, readJson, type RouteContext } from "@/lib/http";
import { decorItemSchema, decorStatusPatchSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = RouteContext<{ id: string }>;

const parseId = async ({ params }: Ctx) => uuidSchema.safeParse((await params).id);

export const GET = decorRoute<Ctx>(async (_req, ctx) => {
  const id = await parseId(ctx);
  if (!id.success) return badRequest("invalid_id");
  const item = await getItem(id.data);
  return item ? ok({ item }) : notFound("item_not_found");
});

export const PUT = decorRoute<Ctx>(async (req, ctx) => {
  const id = await parseId(ctx);
  if (!id.success) return badRequest("invalid_id");
  const body = await readJson(req, decorItemSchema);
  if (body.response) return body.response;
  try {
    const item = await replaceItem(id.data, body.data);
    return item ? ok({ item }) : notFound("item_not_found");
  } catch (err) {
    const ref = itemReferenceError(err);
    if (ref) return badRequest(ref);
    throw err;
  }
});

export const PATCH = decorRoute<Ctx>(async (req, ctx) => {
  const id = await parseId(ctx);
  if (!id.success) return badRequest("invalid_id");
  const body = await readJson(req, decorStatusPatchSchema);
  if (body.response) return body.response;
  const item = await setItemStatus(id.data, body.data.status);
  return item ? ok({ item }) : notFound("item_not_found");
});

export const DELETE = decorRoute<Ctx>(async (_req, ctx) => {
  const id = await parseId(ctx);
  if (!id.success) return badRequest("invalid_id");
  const blobs = await deleteItem(id.data);
  if (!blobs) return notFound("item_not_found");
  await deleteBlobs(blobs);
  return ok();
});
