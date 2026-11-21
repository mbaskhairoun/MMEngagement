import { describe, expect, it } from "vitest";
import { blobStoreHost, imageExtension, isBlobUrl } from "@/lib/blob";

describe("blobStoreHost", () => {
  it("derives the public host from a read-write token", () => {
    expect(blobStoreHost("vercel_blob_rw_AbCd1234_secretpart")).toBe("abcd1234.public.blob.vercel-storage.com");
    expect(blobStoreHost(undefined)).toBeNull();
    expect(blobStoreHost("garbage")).toBeNull();
  });
});

describe("isBlobUrl", () => {
  const host = "abcd1234.public.blob.vercel-storage.com";

  it("accepts only https URLs on our store when the host is known", () => {
    expect(isBlobUrl(`https://${host}/decor/x/a.jpg`, host)).toBe(true);
    expect(isBlobUrl("https://other.public.blob.vercel-storage.com/decor/x/a.jpg", host)).toBe(false);
    expect(isBlobUrl(`http://${host}/decor/x/a.jpg`, host)).toBe(false);
  });

  it("falls back to any public blob host when the store is unknown", () => {
    expect(isBlobUrl("https://zz.public.blob.vercel-storage.com/a.jpg", null)).toBe(true);
    expect(isBlobUrl("https://public.blob.vercel-storage.com/a.jpg", null)).toBe(false);
    expect(isBlobUrl("https://evil.com/.public.blob.vercel-storage.com/a.jpg", null)).toBe(false);
    expect(isBlobUrl("https://zz.public.blob.vercel-storage.com.evil.com/a.jpg", null)).toBe(false);
    expect(isBlobUrl("not a url", null)).toBe(false);
  });
});

describe("imageExtension", () => {
  it("prefers the content type, then the URL", () => {
    expect(imageExtension("image/png; charset=binary")).toBe("png");
    expect(imageExtension(null, "https://i.pinimg.com/originals/a/b.webp")).toBe("webp");
    expect(imageExtension(null)).toBe("jpg");
  });
});
