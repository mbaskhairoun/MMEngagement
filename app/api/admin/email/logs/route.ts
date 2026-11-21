import { adminRoute } from "@/lib/auth";
import { listEmailLogs } from "@/lib/data/email-logs";
import { ok, parseWith } from "@/lib/http";
import { emailLogsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async (req) => {
  const query = parseWith(emailLogsQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
  if (query.response) return query.response;
  return ok({ logs: await listEmailLogs(query.data.limit) });
});
