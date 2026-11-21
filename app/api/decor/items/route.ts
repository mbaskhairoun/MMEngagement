import { createItem, itemReferenceError, listItems } from "@/lib/data/decor";
import { decorRoute } from "@/lib/decor-auth";
import { badRequest, ok, parseWith, readJson } from "@/lib/http";
import { decorItemSchema, decorItemsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = decorRoute(async (req) => {
  const query = parseWith(decorItemsQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
  if (query.response) return query.response;
  return ok({ items: await listItems(query.data) });
});

export const POST = decorRoute(async (req) => {
  const body = await readJson(req, decorItemSchema);
  if (body.response) return body.response;
  try {
    return ok({ item: await createItem(body.data) }, 201);
  } catch (err) {
    const ref = itemReferenceError(err);
    if (ref) return badRequest(ref);
    throw err;
  }
});
