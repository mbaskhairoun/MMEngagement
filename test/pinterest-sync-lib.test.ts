import { describe, expect, it } from "vitest";
import {
  checkCapture,
  imageExtension,
  imageHash,
  isNumericPinId,
  normalisePin,
  parseEnv,
  pickSlug,
  rssPubDates,
  slugify,
} from "@/scripts/pinterest/lib.mjs";
import { slugify as tsSlugify } from "@/lib/validation";

describe("checkCapture (50% safety rule)", () => {
  it("passes at or above half of the expected pins", () => {
    expect(checkCapture(63, 63)).toEqual({ ok: true, ratio: 1, reason: null });
    expect(checkCapture(10, 5).ok).toBe(true);
  });

  it("fails below half, so the sync writes nothing and exits 1", () => {
    const result = checkCapture(63, 31);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/captured 31 of 63/);
    expect(checkCapture(63, 0).ok).toBe(false);
  });

  it("fails when the board count could not be read", () => {
    expect(checkCapture(0, 0).ok).toBe(false);
    expect(checkCapture(Number.NaN, 10).ok).toBe(false);
  });
});

describe("sync helpers", () => {
  it("slugify matches the server implementation", () => {
    for (const t of ["Dance Floor", "Unique ideas", "Café & Bar!", "  ", "Tables"]) expect(slugify(t)).toBe(tsSlugify(t));
  });

  it("pickSlug suffixes a slug owned by another section", () => {
    const taken = new Map<string, string | null>([["tables", null], ["bar", "111"]]);
    expect(pickSlug("tables", "3976402903519128640", taken)).toBe("tables-8640");
    expect(pickSlug("bar", "111", taken)).toBe("bar");
    expect(pickSlug("cake", "222", taken)).toBe("cake");
  });

  it("image helpers", () => {
    expect(imageHash("https://i.pinimg.com/originals/20/1b/20/201b20e9c6fc9063e82d67d21c92146f.jpg")).toBe(
      "201b20e9c6fc9063e82d67d21c92146f",
    );
    expect(imageExtension(null, "https://i.pinimg.com/originals/x.jpeg")).toBe("jpg");
    expect(isNumericPinId("783485666540657856")).toBe(true);
    expect(isNumericPinId("e1_AfqP")).toBe(false);
  });

  it("parseEnv handles quotes, comments and export", () => {
    expect(parseEnv('# c\nA=1\nexport B="two words"\nC=\'x#y\'\nD=val # note\nbad line')).toEqual({
      A: "1",
      B: "two words",
      C: "x#y",
      D: "val",
    });
  });

  it("normalisePin maps resource JSON and rejects pins without images", () => {
    expect(
      normalisePin({
        id: "1",
        grid_title: " Hi ",
        description: "",
        images: { orig: { url: "https://i.pinimg.com/originals/a.jpg", width: 10, height: 20 } },
        dominant_color: "#fff",
        link: null,
      }),
    ).toEqual({
      pinterestId: "1",
      title: "Hi",
      description: null,
      sourceImageUrl: "https://i.pinimg.com/originals/a.jpg",
      width: 10,
      height: 20,
      dominantColor: "#fff",
      pinUrl: "https://www.pinterest.com/pin/1/",
      link: null,
      pinnedAt: null,
    });
    expect(normalisePin({ id: "2" })).toBeNull();
  });

  it("rssPubDates maps image hash to pubDate", () => {
    const xml =
      "<item><description>&lt;img src=&quot;https://i.pinimg.com/236x/20/1b/20/201b20e9c6fc9063e82d67d21c92146f.jpg&quot;&gt;</description><pubDate>Thu, 05 Nov 2026 03:04:59 GMT</pubDate></item>";
    expect(rssPubDates(xml).get("201b20e9c6fc9063e82d67d21c92146f")).toBe("2026-11-05T03:04:59.000Z");
  });
});
