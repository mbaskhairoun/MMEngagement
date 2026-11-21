import { adminRoute } from "@/lib/auth";
import { getFormConfig, updateFormConfig } from "@/lib/data/settings";
import { ok, readJson } from "@/lib/http";
import { settingsUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok(await getFormConfig()));

export const PUT = adminRoute(async (req) => {
  const body = await readJson(req, settingsUpdateSchema);
  if (body.response) return body.response;
  return ok(await updateFormConfig(body.data));
});
