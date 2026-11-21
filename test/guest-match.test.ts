import { describe, expect, it } from "vitest";
import { fuzzyScore, levenshtein, matchGuests, MAX_SUGGESTIONS, normalize, wordsMatch } from "@/lib/guest-match";

const guests = [
  { id: "1", invitationName: "The Baskhairoun Family", members: ["Michael Baskhairoun", "Mina Baskhairoun"] },
  { id: "2", invitationName: "Marly Hanna", members: ["Marly Hanna"] },
  { id: "3", invitationName: "John & Sarah Smith", members: ["John Smith", "Sarah Smith"] },
  { id: "4", invitationName: "Sarah Jones", members: [] },
];

describe("normalize", () => {
  it("lowercases, trims, collapses whitespace and strips accents/punctuation", () => {
    expect(normalize("  José   ÉLIAS. ")).toBe("jose elias");
    expect(normalize("John & Sarah")).toBe("john sarah");
  });
});

describe("levenshtein / fuzzyScore", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
  it("accepts up to max(3, 30%) edits", () => {
    expect(fuzzyScore("micheal baskhairon", "michael baskhairoun")).toBe(3);
    expect(fuzzyScore("bob", "michael baskhairoun")).toBe(Infinity);
  });
  it("wordsMatch requires every typed word to prefix a candidate word", () => {
    expect(wordsMatch("mich bask", "michael baskhairoun")).toBe(true);
    expect(wordsMatch("mich x", "michael baskhairoun")).toBe(false);
  });
});

describe("matchGuests", () => {
  it("matches the invitation name exactly, ignoring case", () => {
    const r = matchGuests(guests, "marly hanna");
    expect(r.exact?.id).toBe("2");
    expect(r.matchedName).toBe("Marly Hanna");
    expect(r.candidates).toEqual([]);
  });

  it("matches a household member exactly", () => {
    const r = matchGuests(guests, "Mina Baskhairoun");
    expect(r.exact?.id).toBe("1");
    expect(r.matchedName).toBe("Mina Baskhairoun");
  });

  it("resolves a unique word-prefix match", () => {
    const r = matchGuests(guests, "Mich Bask");
    expect(r.exact?.id).toBe("1");
    expect(r.matchedName).toBe("Michael Baskhairoun");
  });

  it("returns candidates when a partial match is ambiguous", () => {
    const r = matchGuests(guests, "sarah");
    expect(r.exact).toBeNull();
    expect(r.candidates.map((c) => c.guest.id).sort()).toEqual(["3", "4"]);
  });

  it("suggests fuzzy matches for typos, best first", () => {
    const r = matchGuests(guests, "Marley Hana");
    expect(r.exact).toBeNull();
    expect(r.candidates[0]).toMatchObject({ matchedName: "Marly Hanna", score: 2 });
  });

  it("returns nothing for empty or unknown names", () => {
    expect(matchGuests(guests, "   ")).toEqual({ exact: null, matchedName: null, candidates: [] });
    expect(matchGuests(guests, "Zebediah Quartermaine").candidates).toEqual([]);
  });

  it("caps suggestions so a vague query cannot enumerate the guest list", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: String(i), invitationName: `Anna ${i}`, members: [] }));
    expect(matchGuests(many, "anna").candidates).toHaveLength(MAX_SUGGESTIONS);
  });
});
