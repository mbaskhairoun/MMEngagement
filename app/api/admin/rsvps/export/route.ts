import { adminRoute } from "@/lib/auth";
import { rsvpsCsvByHousehold, rsvpsCsvByMember } from "@/lib/csv";
import { listRsvpsAdmin } from "@/lib/data/rsvps";
import { parseWith } from "@/lib/http";
import { exportQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async (req) => {
  const query = parseWith(exportQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
  if (query.response) return query.response;
  const rsvps = await listRsvpsAdmin();
  const byMember = query.data.by === "member";
  const csv = byMember ? rsvpsCsvByMember(rsvps) : rsvpsCsvByHousehold(rsvps);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${byMember ? "rsvps-by-member.csv" : "rsvps.csv"}"`,
      "Cache-Control": "no-store",
    },
  });
});
