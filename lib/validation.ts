import { z } from "zod";

export const LIMITS = {
  name: 100,
  email: 254,
  phone: 40,
  short: 200,
  message: 1000,
  notes: 1000,
  members: 20,
  importRows: 2000,
  broadcastRecipients: 200,
  subject: 200,
  html: 100_000,
} as const;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EVENT_IDS = ["ceremony", "reception"] as const;

export const uuidSchema = z.string().uuid("must be a valid UUID");

const name = z.string().trim().min(1, "required").max(LIMITS.name);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.email)
  .regex(EMAIL_REGEX, "must be a valid email address");

/** Optional free text: trimmed, empty becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalEmail = z
  .union([z.literal(""), emailSchema])
  .nullish()
  .transform((v) => (v ? v : null));

const uniqueNames = (list: string[]) => new Set(list.map((n) => n.toLowerCase())).size === list.length;

const memberList = z
  .array(name)
  .max(LIMITS.members, `at most ${LIMITS.members} members`)
  .refine(uniqueNames, "names must be unique");

export const lookupSchema = z.object({ name });

export const rsvpSchema = z.object({
  guestId: uuidSchema,
  fullName: name,
  email: emailSchema,
  phone: optionalText(LIMITS.phone),
  attending: z.boolean(),
  attendingMembers: memberList,
  declinedMembers: memberList,
  memberEmails: z
    .record(z.string().trim().max(LIMITS.name), z.union([z.literal(""), emailSchema]))
    .optional()
    .transform((rec) => Object.fromEntries(Object.entries(rec ?? {}).filter(([k, v]) => k && v)))
    .refine((rec) => Object.keys(rec).length <= LIMITS.members, `at most ${LIMITS.members} member emails`),
  events: z
    .array(z.enum(EVENT_IDS))
    .max(EVENT_IDS.length)
    .optional()
    .transform((list) => [...new Set(list ?? [])]),
  relationship: optionalText(LIMITS.short),
  mealPreference: optionalText(LIMITS.short),
  dietaryRestrictions: optionalText(LIMITS.message),
  childrenCount: z.number().int().min(0).max(LIMITS.members).optional().default(0),
  childrenAges: optionalText(LIMITS.short),
  songRequest: optionalText(LIMITS.short),
  transportNeeded: z.boolean().optional().default(false),
  accommodationNeeded: z.boolean().optional().default(false),
  specialRequests: optionalText(LIMITS.message),
  message: optionalText(LIMITS.message),
});
export type RsvpInput = z.infer<typeof rsvpSchema>;

export const guestInputSchema = z.object({
  invitationName: name,
  email: optionalEmail,
  members: z
    .array(z.string().trim().max(LIMITS.name))
    .max(LIMITS.members, `at most ${LIMITS.members} members`)
    .optional()
    .transform((list) => (list ?? []).filter(Boolean))
    .refine(uniqueNames, "names must be unique"),
  notes: optionalText(LIMITS.notes),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

export const guestImportSchema = z.object({
  mode: z.enum(["append", "replace"]),
  guests: z.array(guestInputSchema).min(1).max(LIMITS.importRows),
});

const fieldKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/, "invalid field key");

export const formConfigSchema = z.object({
  rsvpDisabled: z.boolean(),
  fields: z.record(fieldKey, z.boolean()),
});
export type FormConfig = z.infer<typeof formConfigSchema>;

export const settingsUpdateSchema = z
  .object({
    rsvpDisabled: z.boolean().optional(),
    fields: z
      .record(fieldKey, z.boolean())
      .refine((r) => Object.keys(r).length <= 50, "too many fields")
      .optional(),
  })
  .strict();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const loginSchema = z.object({ password: z.string().min(1).max(200) });

export const emailSendSchema = z.object({
  to: z
    .array(z.object({ email: emailSchema, name: optionalText(LIMITS.name) }))
    .min(1)
    .max(LIMITS.broadcastRecipients, `at most ${LIMITS.broadcastRecipients} recipients per call`),
  subject: z.string().trim().min(1).max(LIMITS.subject),
  html: z.string().trim().min(1).max(LIMITS.html),
  headerLabel: optionalText(LIMITS.name),
  footerMessage: optionalText(LIMITS.short),
  preheader: optionalText(LIMITS.short),
});

export const emailLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const exportQuerySchema = z.object({
  by: z.enum(["household", "member"]).default("household"),
});

// ── Decor portal ─────────────────────────────────────────────────────────────

export const DECOR_LIMITS = {
  itemName: 120,
  description: 2000,
  unit: 30,
  vendor: 120,
  notes: 2000,
  addedBy: 80,
  link: 2000,
  sectionTitle: 80,
  maxCost: 9_999_999_999.99, // numeric(12,2)
  maxQuantity: 1_000_000,
} as const;

const DECOR_STATUS_VALUES = ["proposed", "approved", "ordered", "declined"] as const;
export const decorStatusSchema = z.enum(DECOR_STATUS_VALUES);

const nullableUuid = uuidSchema.nullish().transform((v) => v ?? null);

const httpUrl = z
  .string()
  .trim()
  .max(DECOR_LIMITS.link)
  .url("must be a valid URL")
  .refine((v) => /^https?:\/\//i.test(v), "must be an http(s) URL");

const optionalUrl = z
  .union([z.literal(""), httpUrl])
  .nullish()
  .transform((v) => (v ? v : null));

export const decorItemSchema = z.object({
  name: z.string().trim().min(1, "required").max(DECOR_LIMITS.itemName),
  sectionId: nullableUuid,
  inspoPinId: nullableUuid,
  description: optionalText(DECOR_LIMITS.description),
  quantity: z.number().int().min(0).max(DECOR_LIMITS.maxQuantity).optional().default(1),
  unit: optionalText(DECOR_LIMITS.unit),
  estimatedCost: z
    .number()
    .min(0)
    .max(DECOR_LIMITS.maxCost)
    .nullish()
    .transform((v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100)),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "must be a 3-letter currency code")
    .transform((v) => v.toUpperCase())
    .optional()
    .default("EGP"),
  status: decorStatusSchema.optional().default("proposed"),
  vendor: optionalText(DECOR_LIMITS.vendor),
  link: optionalUrl,
  notes: optionalText(DECOR_LIMITS.notes),
  addedBy: optionalText(DECOR_LIMITS.addedBy),
});
export type DecorItemInput = z.infer<typeof decorItemSchema>;

export const decorStatusPatchSchema = z.object({ status: decorStatusSchema }).strict();

export const decorItemsQuerySchema = z.object({
  sectionId: z
    .union([z.literal(""), uuidSchema])
    .optional()
    .transform((v) => v || undefined),
  status: z
    .union([z.literal(""), decorStatusSchema])
    .optional()
    .transform((v) => v || undefined),
});

export const sectionCreateSchema = z.object({
  title: z.string().trim().min(1, "required").max(DECOR_LIMITS.sectionTitle),
});

export const sectionPatchSchema = z
  .object({
    title: z.string().trim().min(1, "required").max(DECOR_LIMITS.sectionTitle).optional(),
    sortOrder: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  .strict()
  .refine((v) => v.title !== undefined || v.sortOrder !== undefined, "nothing to update");

export const pinPatchSchema = z.object({ sectionId: uuidSchema.nullable() }).strict();

export const photoCreateSchema = z.object({
  url: z.string().trim().url().max(DECOR_LIMITS.link),
  pathname: z.string().trim().min(1).max(500),
  width: z.number().int().min(1).max(100_000).nullish().transform((v) => v ?? null),
  height: z.number().int().min(1).max(100_000).nullish().transform((v) => v ?? null),
});

export const inspoQuerySchema = z.object({
  includeRemoved: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export const syncQuerySchema = z.object({
  full: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

/** URL slug: lower-case ASCII words joined by `-` (falls back to `category`). */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "category";
}
