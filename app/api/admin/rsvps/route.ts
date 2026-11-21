import { adminRoute } from "@/lib/auth";
import { listRsvpsAdmin } from "@/lib/data/rsvps";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok({ rsvps: await listRsvpsAdmin() }));
