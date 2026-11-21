import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitStatements } from "@/db/migrate";
import { csvCell, rsvpsCsvByMember } from "@/lib/csv";
import type { RsvpAdmin } from "@/lib/db";

describe("csv", () => {
  it("quotes cells and neutralises formulas", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=SUM(A1)")).toBe(`"'=SUM(A1)"`);
    expect(csvCell(null)).toBe('""');
  });

  it("emits one row per attending individual", () => {
    const rsvp = {
      invitationName: "Fam",
      fullName: "Ann Lee",
      email: "ann@x.co",
      phone: "123",
      attending: true,
      attendingMembers: ["Ann Lee", "Bo Lee"],
      memberEmails: { "Bo Lee": "bo@x.co" },
      events: ["ceremony"],
      mealPreference: "fish",
      dietaryRestrictions: null,
      createdAt: "2026-11-19T00:00:00.000Z",
    } as unknown as RsvpAdmin;
    const lines = rsvpsCsvByMember([rsvp, { ...rsvp, attending: false }]).trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Ann Lee","Fam","ann@x.co","123"');
    expect(lines[2]).toContain('"Bo Lee","Fam","bo@x.co",""');
  });
});

describe("splitStatements", () => {
  it("splits schema.sql into statements without comments", () => {
    const statements = splitStatements(readFileSync("db/schema.sql", "utf8"));
    expect(statements).toHaveLength(17); // 9 core + 8 decor portal (4 tables, 4 indexes)
    expect(statements.every((s) => !s.includes("--"))).toBe(true);
    expect(statements[0]).toBe("create extension if not exists pgcrypto");
  });
});
