export declare const MIN_CAPTURE_RATIO: number;
export declare function checkCapture(
  expected: number,
  captured: number,
): { ok: boolean; ratio: number; reason: string | null };
export declare function slugify(title: string): string;
export declare function imageHash(url: string | null | undefined): string | null;
export declare function imageExtension(contentType: string | null | undefined, url?: string): string;
export declare function isNumericPinId(id: string): boolean;
export declare const BLOB_HOST_SUFFIX: string;
export declare function isBlobUrl(url: string): boolean;
export declare function parseEnv(text: string): Record<string, string>;
export declare function pickSlug(slug: string, pinterestId: string, takenBy: Map<string, string | null>): string;
export type NormalisedPin = {
  pinterestId: string;
  title: string | null;
  description: string | null;
  sourceImageUrl: string;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  pinUrl: string;
  link: string | null;
  pinnedAt: string | null;
};
export declare function normalisePin(d: unknown): NormalisedPin | null;
export declare function boardRssUrl(boardUrl: string): string;
export declare function rssPubDates(xml: string): Map<string, string>;
