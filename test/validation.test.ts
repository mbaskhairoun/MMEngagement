import { describe, expect, it } from "vitest";
import { applyRsvpRules } from "@/lib/rsvp-rules";
import {
  emailSendSchema,
  guestImportSchema,
  guestInputSchema,
  lookupSchema,
  rsvpSchema,
  settingsUpdateSchema,
} from "@/lib/validation";

const GUEST_ID = "6f1c1b7e-9a43-4c1e-8f43-2b7f5d6a9c10";
const baseRsvp = {
  guestId: GUEST_ID,
  fullName: "Michael Baskhairoun",
  email: "  Michael@Example.com ",
  attending: true,
  attendingMembers: ["Michael Baskhairoun"],
  declinedMembers: [],
};

describe("lookupSchema", () => {
  it("trims and requires a name of at most 100 chars", () => {
    expect(lookupSchema.parse({ name: "  Marly " })).toEqual({ name: "Marly" });
    expect(lookupSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(lookupSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
  });
});

describe("rsvpSchema", () => {
  it("normalises email, defaults optionals, empties to null", () => {
    const r = rsvpSchema.parse({ ...baseRsvp, phone: "  ", memberEmails: { Mina: "", Michael: "m@x.co" } });
    expect(r.email).toBe("michael@example.com");
    expect(r.phone).toBeNull();
    expect(r.memberEmails).toEqual({ Michael: "m@x.co" });
    expect(r.events).toEqual([]);
    expect(r.childrenCount).toBe(0);
    expect(r.transportNeeded).toBe(false);
  });

  it("rejects bad uuid, email, oversize message, too many members, duplicates and unknown events", () => {
    const bad = [
      { guestId: "nope" },
      { email: "not-an-email" },
      { message: "x".repeat(1001) },
      { attendingMembers: Array.from({ length: 21 }, (_, i) => `M${i}`) },
      { attendingMembers: ["Ann", "ann"] },
      { events: ["brunch"] },
      { childrenCount: -1 },
    ];
    for (const patch of bad) expect(rsvpSchema.safeParse({ ...baseRsvp, ...patch }).success, JSON.stringify(patch)).toBe(false);
  });
});

describe("applyRsvpRules", () => {
  const guest = { invitationName: "The Baskhairoun Family", members: ["Michael Baskhairoun", "Mina Baskhairoun"] };
  const parse = (patch: object) => rsvpSchema.parse({ ...baseRsvp, ...patch });

  it("canonicalises member names and defaults events to both", () => {
    const r = applyRsvpRules(guest, parse({ attendingMembers: ["michael baskhairoun"], declinedMembers: ["MINA BASKHAIROUN"] }));
    expect(r.value?.attendingMembers).toEqual(["Michael Baskhairoun"]);
    expect(r.value?.declinedMembers).toEqual(["Mina Baskhairoun"]);
    expect(r.value?.events).toEqual(["ceremony", "reception"]);
  });

  it("rejects strangers, overlaps and inconsistent attending flags", () => {
    expect(applyRsvpRules(guest, parse({ attendingMembers: ["Someone Else"] })).error).toBe("invalid_member");
    expect(applyRsvpRules(guest, parse({ memberEmails: { Stranger: "s@x.co" } })).error).toBe("invalid_member");
    expect(
      applyRsvpRules(guest, parse({ declinedMembers: ["Michael Baskhairoun"] })).error,
    ).toBe("member_overlap");
    expect(applyRsvpRules(guest, parse({ attendingMembers: [] })).error).toBe("attending_members_required");
    expect(applyRsvpRules(guest, parse({ attending: false })).error).toBe("attending_members_must_be_empty");
  });

  it("clears attendee-only details when declining", () => {
    const r = applyRsvpRules(
      guest,
      parse({ attending: false, attendingMembers: [], declinedMembers: ["Michael Baskhairoun"], mealPreference: "fish", events: ["ceremony"], message: "Love you" }),
    );
    expect(r.value).toMatchObject({ mealPreference: null, events: [], message: "Love you" });
  });

  it("treats a household without members as its invitation name", () => {
    const solo = { invitationName: "Marly Hanna", members: [] };
    expect(applyRsvpRules(solo, parse({ attendingMembers: ["Marly Hanna"] })).value?.attendingMembers).toEqual(["Marly Hanna"]);
  });
});

describe("guest schemas", () => {
  it("drops blank members and treats empty email as null", () => {
    expect(guestInputSchema.parse({ invitationName: " Smiths ", email: "", members: ["John", " ", "Sarah"] })).toEqual({
      invitationName: "Smiths",
      email: null,
      members: ["John", "Sarah"],
      notes: null,
    });
    expect(guestInputSchema.safeParse({ invitationName: "A", email: "bad" }).success).toBe(false);
  });
  it("validates import mode and size", () => {
    expect(guestImportSchema.safeParse({ mode: "merge", guests: [{ invitationName: "A" }] }).success).toBe(false);
    expect(guestImportSchema.safeParse({ mode: "append", guests: [] }).success).toBe(false);
    expect(guestImportSchema.parse({ mode: "replace", guests: [{ invitationName: "A" }] }).guests[0].members).toEqual([]);
  });
});

describe("settings and email schemas", () => {
  it("accepts partial settings and rejects unknown keys", () => {
    expect(settingsUpdateSchema.parse({ fields: { phone: false } })).toEqual({ fields: { phone: false } });
    expect(settingsUpdateSchema.safeParse({ other: true }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ fields: { "bad key": true } }).success).toBe(false);
  });
  it("caps broadcast recipients at 200 and validates addresses", () => {
    const to = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `g${i}@x.co` }));
    expect(emailSendSchema.safeParse({ to: to(200), subject: "Hi", html: "Body" }).success).toBe(true);
    expect(emailSendSchema.safeParse({ to: to(201), subject: "Hi", html: "Body" }).success).toBe(false);
    expect(emailSendSchema.safeParse({ to: [{ email: "nope" }], subject: "Hi", html: "Body" }).success).toBe(false);
  });
});
