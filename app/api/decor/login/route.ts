import { decorAuthConfig, decorPasswordMatches, setDecorCookie } from "@/lib/decor-auth";
import { fail, ok, readJson, route, tooManyRequests } from "@/lib/http";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failedLogins = createRateLimiter(5, 15 * 60 * 1000);

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const retryAfter = failedLogins.retryAfter(ip);
  if (retryAfter > 0) return tooManyRequests(retryAfter);

  const config = decorAuthConfig();
  if (!config) {
    console.error("[decor-auth] DECOR_PASSWORD or SESSION_SECRET (min 16 chars) is not configured");
    return fail(500, "auth_not_configured");
  }

  const body = await readJson(req, loginSchema);
  if (body.response) return body.response;

  if (!decorPasswordMatches(body.data.password, config.password)) {
    failedLogins.hit(ip);
    return fail(401, "invalid_password");
  }

  failedLogins.reset(ip);
  const res = ok();
  setDecorCookie(res, config.secret);
  return res;
});
