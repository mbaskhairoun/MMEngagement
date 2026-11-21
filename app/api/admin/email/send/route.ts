import { adminRoute } from "@/lib/auth";
import { fail, ok, readJson, serviceUnavailable } from "@/lib/http";
import { sendBroadcast } from "@/lib/mail";
import { emailSendSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute(async (req) => {
  const body = await readJson(req, emailSendSchema);
  if (body.response) return body.response;
  const { to, subject, html, headerLabel, footerMessage, preheader } = body.data;

  const outcome = await sendBroadcast({ recipients: to, subject, bodyHtml: html, headerLabel, footerMessage, preheader });
  if (outcome.skipped) return serviceUnavailable("email_not_configured");

  const { succeeded, failed } = outcome;
  if (succeeded === 0) return fail(502, "send_failed", { succeeded, failed });
  return ok({ succeeded, failed }, failed.length > 0 ? 207 : 200);
});
