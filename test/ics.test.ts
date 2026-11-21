import { describe, expect, it } from "vitest";
import { buildWeddingIcs, escapeIcsText, foldLine, localDateTime } from "@/lib/ics";

const ics = buildWeddingIcs(new Date("2026-11-19T12:00:00Z"));
const unfolded = ics.replace(/\r\n /g, "");

describe("buildWeddingIcs", () => {
  it("is a CRLF VCALENDAR with a Cairo VTIMEZONE and two events", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(unfolded).toContain("BEGIN:VTIMEZONE\r\nTZID:Africa/Cairo");
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(unfolded.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(unfolded.match(/TRIGGER:-PT1H/g)).toHaveLength(2);
  });

  it("uses local Cairo times and stable UIDs", () => {
    expect(unfolded).toContain("DTSTART;TZID=Africa/Cairo:20270823T130000");
    expect(unfolded).toContain("DTEND;TZID=Africa/Cairo:20270823T143000");
    expect(unfolded).toContain("DTSTART;TZID=Africa/Cairo:20270823T170000");
    expect(unfolded).toContain("DTEND;TZID=Africa/Cairo:20270824T000000");
    expect(unfolded).toContain("UID:marly-michael-wedding-ceremony@marlybaskha.ca");
    expect(unfolded).toContain("UID:marly-michael-wedding-reception@marlybaskha.ca");
    expect(unfolded).toContain("DTSTAMP:20261119T120000Z");
    expect(unfolded).toContain("LOCATION:St. Mary Church\\, El Rehab City\\, New Cairo");
  });

  it("folds every line to at most 75 octets", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("helpers", () => {
  it("escapes text values", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
  });
  it("folds long lines with a leading space", () => {
    const folded = foldLine("X".repeat(100));
    expect(folded).toBe(`${"X".repeat(75)}\r\n ${"X".repeat(25)}`);
  });
  it("does wall-clock arithmetic across midnight", () => {
    expect(localDateTime("2027-08-23", "23:30", 45)).toBe("20270824T001500");
  });
});
