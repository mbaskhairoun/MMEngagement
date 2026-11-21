import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { itemExists } from "@/lib/data/decor";
import { requireDecor } from "@/lib/decor-auth";
import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from "@/lib/decor-types";
import { badRequest, fail, json, parseWith, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shape check only; `handleUpload` validates the details (and the callback signature). */
const uploadEventSchema = z
  .object({
    type: z.enum(["blob.generate-client-token", "blob.upload-completed"]),
    payload: z.object({}).passthrough(),
  })
  .passthrough();

const PATHNAME = /^decor\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[A-Za-z0-9._-]{1,120}$/i;

class UploadRejected extends Error {}

/**
 * Client-upload token exchange for decorator photos. The browser's token request must
 * carry a decor/admin session; the `blob.upload-completed` callback comes from Vercel
 * (no cookie) and is authenticated by `handleUpload`'s signature check instead.
 */
export const POST = route(async (req) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("invalid_json");
  }
  const parsed = parseWith(uploadEventSchema, raw);
  if (parsed.response) return parsed.response;
  if (parsed.data.type === "blob.generate-client-token") {
    const denied = requireDecor(req);
    if (denied) return denied;
  }
  try {
    const result = await handleUpload({
      request: req,
      // The untouched body: the completion callback's signature is computed over it.
      body: raw as HandleUploadBody,
      onBeforeGenerateToken: async (pathname) => {
        const itemId = PATHNAME.exec(pathname)?.[1];
        if (!itemId) throw new UploadRejected("invalid_pathname");
        if (!(await itemExists(itemId))) throw new UploadRejected("item_not_found");
        return {
          allowedContentTypes: [...UPLOAD_CONTENT_TYPES],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      // Photos are registered by the browser via POST /api/decor/items/:id/photos.
      onUploadCompleted: async () => {},
    });
    return json(result);
  } catch (err) {
    if (err instanceof UploadRejected) return badRequest(err.message);
    console.error("[decor-upload] handleUpload failed:", err);
    return fail(400, "upload_rejected");
  }
});
