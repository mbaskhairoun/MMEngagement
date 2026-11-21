import { decorRole } from "@/lib/decor-auth";
import { ok, route, unauthorized } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const role = decorRole(req);
  return role ? ok({ authenticated: true, role }) : unauthorized();
});
