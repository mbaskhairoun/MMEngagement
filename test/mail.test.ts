import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/email-logs", () => ({ writeEmailLog: vi.fn(async () => undefined) }));

import { writeEmailLog } from "@/lib/data/email-logs";
import type { RsvpPublic } from "@/lib/db";
import {
  dedupeRecipients,
  firstName,
  MAILERSEND_ENDPOINT,
  normalizeBodyHtml,
  personalize,
  sendBroadcast,
  sendRsvpConfirmation,
} from "@/lib/mail";

type Sent = { to: Array<{ email: string; name?: string }>; subject: string; html: string; text: string; attachments?: Array<{ filename: string; content: string }> };

const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body)) as Sent;
  return body.to[0].email.startsWith("fail")
    ? new Response("rejected", { status: 422 })
    : new Response(null, { status: 202 });
});
const sent = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)) as Sent);

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("MAILERSEND_API_TOKEN", "token");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("helpers", () => {
  it("personalises name, first name and email, escaping when asked", () => {
    const r = { email: "a@x.co", name: "Mina <B> Baskhairoun" };
    expect(personalize("Hi {{first_name}} / {{ name }} / {{EMAIL}}", r)).toBe("Hi Mina / Mina <B> Baskhairoun / a@x.co");
    expect(personalize("{{name}}", r, true)).toBe("Mina &lt;B&gt; Baskhairoun");
    expect(personalize("{{first_name}}", { email: "solo@x.co" })).toBe("solo@x.co");
    expect(firstName(null)).toBe("Friend");
  });

  it("dedupes case-insensitively and drops invalid addresses", () => {
    expect(
      dedupeRecipients([{ email: "A@x.co", name: "A" }, { email: " a@X.co " }, { email: "bad" }, { email: "b@x.co" }]),
    ).toEqual([{ email: "A@x.co", name: "A" }, { email: "b@x.co", name: null }]);
  });

  it("converts plain text bodies to escaped paragraphs and keeps HTML", () => {
    expect(normalizeBodyHtml("One & two\nline\n\nThree")).toMatch(/One &amp; two<br>line<\/p><p[^>]*>Three/);
    expect(normalizeBodyHtml("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});

describe("sendBroadcast", () => {
  it("sends one personalised message per unique recipient and reports failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const outcome = await sendBroadcast({
      recipients: [
        { email: "mina@x.co", name: "Mina Baskhairoun" },
        { email: "MINA@x.co", name: "Duplicate" },
        { email: "fail@x.co", name: "Bad Box" },
      ],
      subject: "Hello {{first_name}}",
      bodyHtml: "Dear {{name}}, see you!",
    });
    expect(outcome).toEqual({ skipped: false, succeeded: 1, failed: [{ email: "fail@x.co", error: "rejected" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(MAILERSEND_ENDPOINT);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer token");
    const [mina] = sent();
    expect(mina.subject).toBe("Hello Mina");
    expect(mina.html).toContain("Dear Mina Baskhairoun, see you!");
    expect(mina.html).toContain("#FBF8F1");
    expect(mina.text).toContain("Dear Mina,");
    expect(writeEmailLog).toHaveBeenCalledWith(
      expect.objectContaining({ type: "broadcast", success: false, statusCode: 422, recipients: ["mina@x.co", "fail@x.co"] }),
    );
  });

  it("sends at most 5 requests concurrently", async () => {
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return new Response(null, { status: 202 });
    });
    const recipients = Array.from({ length: 12 }, (_, i) => ({ email: `g${i}@x.co` }));
    const outcome = await sendBroadcast({ recipients, subject: "S", bodyHtml: "B" });
    expect(outcome).toEqual({ skipped: false, succeeded: 12, failed: [] });
    expect(peak).toBeLessThanOrEqual(5);
  });

  it("skips and logs when the token is missing", async () => {
    vi.stubEnv("MAILERSEND_API_TOKEN", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendBroadcast({ recipients: [{ email: "a@x.co" }], subject: "S", bodyHtml: "B" })).toEqual({ skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeEmailLog).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: expect.stringContaining("skipped") }));
  });
});

describe("sendRsvpConfirmation", () => {
  const rsvp: RsvpPublic = {
    id: "r1",
    guestId: "g1",
    invitationName: "The Baskhairoun Family",
    fullName: "Michael Baskhairoun",
    email: "michael@x.co",
    phone: null,
    attending: true,
    attendingMembers: ["Michael Baskhairoun"],
    declinedMembers: ["Mina Baskhairoun"],
    memberEmails: { "Michael Baskhairoun": "MICHAEL@x.co", "Mina Baskhairoun": "mina@x.co" },
    events: ["ceremony", "reception"],
    relationship: null,
    mealPreference: null,
    dietaryRestrictions: null,
    childrenCount: 0,
    childrenAges: null,
    songRequest: null,
    transportNeeded: false,
    accommodationNeeded: false,
    specialRequests: null,
    message: null,
    createdAt: "2026-11-19T00:00:00.000Z",
    updatedAt: "2026-11-19T00:00:00.000Z",
  };

  it("emails the submitter and member addresses once each with event details and the ICS", async () => {
    const outcome = await sendRsvpConfirmation({ guest: { id: "g1" }, rsvp, isUpdate: true });
    expect(outcome).toEqual({ skipped: false, succeeded: 2, failed: [] });
    const messages = sent();
    expect(messages.map((m) => m.to[0].email)).toEqual(["michael@x.co", "mina@x.co"]);
    const [first, second] = messages;
    expect(first.subject).toBe("RSVP Updated — Marly & Michael's Wedding");
    expect(first.html).toContain("Thank you, Michael");
    expect(second.html).toContain("Thank you, Mina");
    for (const text of ["Joyfully accepts", "Unable to attend", "St. Mary Church", "Jaz Little Venice Golf Resort", "1:00 PM", "5:00 PM", "google.com/maps"]) {
      expect(first.html).toContain(text);
    }
    expect(first.html).not.toMatch(/undefined|null/);
    const ics = Buffer.from(first.attachments?.[0].content ?? "", "base64").toString("utf8");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(writeEmailLog).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rsvp_updated", guestId: "g1", guestName: "Michael Baskhairoun", success: true, statusCode: 202 }),
    );
  });
});
