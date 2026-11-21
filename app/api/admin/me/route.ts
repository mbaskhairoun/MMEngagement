import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok({ authenticated: true }));
