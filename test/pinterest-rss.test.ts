import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boardRssUrl, decodeEntities, parseBoardRss, pinImageAtSize, pinImageHash } from "@/lib/pinterest-rss";

const xml = readFileSync(join(__dirname, "fixtures", "pinterest-board.rss"), "utf8");

describe("parseBoardRss", () => {
  const pins = parseBoardRss(xml);

  it("returns one pin per unique image, skipping duplicates and items without an image", () => {
    expect(pins).toHaveLength(4);
    expect(new Set(pins.map((p) => p.imageHash)).size).toBe(4);
  });

  it("extracts the pin token, link, image and date from an entity-encoded item", () => {
    expect(pins[0]).toEqual({
      pinKey: "e1_AfqPShy4uKIcFiw9moQRSgl4QYf4PtraeL7qNoR38YDXk_LaGjNd",
      pinUrl: "https://ca.pinterest.com/pin/e1_AfqPShy4uKIcFiw9moQRSgl4QYf4PtraeL7qNoR38YDXk_LaGjNd/",
      imageHash: "201b20e9c6fc9063e82d67d21c92146f",
      thumbnailUrl: "https://i.pinimg.com/236x/20/1b/20/201b20e9c6fc9063e82d67d21c92146f.jpg",
      imageUrl: "https://i.pinimg.com/736x/20/1b/20/201b20e9c6fc9063e82d67d21c92146f.jpg",
      title: null,
      description: null,
      pinnedAt: "2026-11-05T03:04:59.000Z",
    });
  });

  it("keeps the title and the description text after the image link", () => {
    expect(pins[1].title).toMatch(/^Make a stylish statement/);
    expect(pins[1].description).toBe(pins[1].title);
  });

  it("handles CDATA sections and png thumbnails", () => {
    const cdata = pins[3];
    expect(cdata.pinKey).toBe("e1_CdataExample123");
    expect(cdata.title).toBe("Tall candles & roses");
    expect(cdata.description).toBe("Gold & ivory centrepiece");
    expect(cdata.imageUrl).toBe("https://i.pinimg.com/736x/aa/bb/cc/aabbcc00112233445566778899aabbcc.jpg");
    expect(cdata.pinnedAt).toBe("2026-11-02T10:00:00.000Z");
  });

  it("returns nothing for non-feed input", () => {
    expect(parseBoardRss("<html><body>blocked</body></html>")).toEqual([]);
  });
});

describe("rss helpers", () => {
  it("matches crawl and feed URLs of the same image by hash", () => {
    const original = "https://i.pinimg.com/originals/20/1b/20/201b20e9c6fc9063e82d67d21c92146f.png";
    expect(pinImageHash(original)).toBe("201b20e9c6fc9063e82d67d21c92146f");
    expect(pinImageHash("https://example.com/a.jpg")).toBeNull();
    expect(pinImageAtSize("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });

  it("derives the feed URL from the board URL", () => {
    expect(boardRssUrl("https://ca.pinterest.com/u/b/")).toBe("https://ca.pinterest.com/u/b.rss");
    expect(boardRssUrl("https://ca.pinterest.com/u/b")).toBe("https://ca.pinterest.com/u/b.rss");
  });

  it("decodes named and numeric entities", () => {
    expect(decodeEntities("a &amp; b &#8217; &#x2014; &lt;i&gt; &bogus;")).toBe("a & b ’ — <i> &bogus;");
  });
});
