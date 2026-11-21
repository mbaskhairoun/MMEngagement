import { describe, expect, it } from "vitest";
import {
  decorItemSchema,
  decorItemsQuerySchema,
  decorStatusPatchSchema,
  pinPatchSchema,
  sectionPatchSchema,
  slugify,
} from "@/lib/validation";

const UUID = "3f2a1c4e-8b7d-4e6f-9a0b-1c2d3e4f5a6b";

describe("decorItemSchema", () => {
  it("applies defaults and nulls empty optionals", () => {
    expect(decorItemSchema.parse({ name: "  Gold chargers ", description: "", link: "" })).toEqual({
      name: "Gold chargers",
      sectionId: null,
      inspoPinId: null,
      description: null,
      quantity: 1,
      unit: null,
      estimatedCost: null,
      currency: "EGP",
      status: "proposed",
      vendor: null,
      link: null,
      notes: null,
      addedBy: null,
    });
  });

  it("accepts a full item and normalises currency and cost", () => {
    const item = decorItemSchema.parse({
      name: "Chiavari chairs",
      sectionId: UUID,
      inspoPinId: UUID,
      quantity: 120,
      unit: "pcs",
      estimatedCost: 45.678,
      currency: "usd",
      status: "approved",
      vendor: "Cairo Rentals",
      link: "https://example.com/chairs",
      notes: "white",
      addedBy: "Nour",
    });
    expect(item.currency).toBe("USD");
    expect(item.estimatedCost).toBe(45.68);
    expect(item.status).toBe("approved");
  });

  it.each([
    ["missing name", { name: " " }],
    ["name too long", { name: "x".repeat(121) }],
    ["negative quantity", { name: "a", quantity: -1 }],
    ["fractional quantity", { name: "a", quantity: 1.5 }],
    ["negative cost", { name: "a", estimatedCost: -5 }],
    ["bad currency", { name: "a", currency: "EURO" }],
    ["bad status", { name: "a", status: "maybe" }],
    ["non-http link", { name: "a", link: "javascript:alert(1)" }],
    ["bad section id", { name: "a", sectionId: "nope" }],
    ["unit too long", { name: "a", unit: "x".repeat(31) }],
    ["description too long", { name: "a", description: "x".repeat(2001) }],
    ["addedBy too long", { name: "a", addedBy: "x".repeat(81) }],
  ])("rejects %s", (_label, body) => {
    expect(decorItemSchema.safeParse(body).success).toBe(false);
  });
});

describe("other decor schemas", () => {
  it("status patch accepts only a known status", () => {
    expect(decorStatusPatchSchema.safeParse({ status: "ordered" }).success).toBe(true);
    expect(decorStatusPatchSchema.safeParse({ status: "ordered", name: "x" }).success).toBe(false);
  });

  it("pin patch requires sectionId as uuid or null", () => {
    expect(pinPatchSchema.safeParse({ sectionId: null }).success).toBe(true);
    expect(pinPatchSchema.safeParse({ sectionId: UUID }).success).toBe(true);
    expect(pinPatchSchema.safeParse({}).success).toBe(false);
  });

  it("section patch needs at least one field", () => {
    expect(sectionPatchSchema.safeParse({}).success).toBe(false);
    expect(sectionPatchSchema.safeParse({ sortOrder: 3 }).success).toBe(true);
  });

  it("items query ignores empty filters", () => {
    expect(decorItemsQuerySchema.parse({ sectionId: "", status: "" })).toEqual({ sectionId: undefined, status: undefined });
    expect(decorItemsQuerySchema.safeParse({ status: "bogus" }).success).toBe(false);
  });

  it("slugify", () => {
    expect(slugify("Dance Floor")).toBe("dance-floor");
    expect(slugify("Café & Bar!")).toBe("cafe-and-bar");
    expect(slugify("!!!")).toBe("category");
  });
});
