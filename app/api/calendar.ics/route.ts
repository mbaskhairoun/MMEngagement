import { buildWeddingIcs } from "@/lib/ics";

export const runtime = "nodejs";

export function GET(): Response {
  return new Response(buildWeddingIcs(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="marly-michael-wedding.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
