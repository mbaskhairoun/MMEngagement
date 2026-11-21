import { sql } from "@/lib/db";
import { formConfigSchema, type FormConfig, type SettingsUpdate } from "@/lib/validation";

const FORM_CONFIG_KEY = "form_config";

export const DEFAULT_FORM_CONFIG: FormConfig = {
  rsvpDisabled: false,
  fields: {
    phone: true,
    relationship: true,
    mealPreference: true,
    dietary: true,
    childrenCount: true,
    songRequest: true,
    transportNeeded: false,
    accommodationNeeded: true,
    specialRequests: true,
    message: true,
  },
};

export async function getFormConfig(): Promise<FormConfig> {
  const rows = await sql`select value from settings where key = ${FORM_CONFIG_KEY}`;
  const parsed = formConfigSchema.partial().safeParse(rows[0]?.value);
  const stored = parsed.success ? parsed.data : {};
  return {
    rsvpDisabled: stored.rsvpDisabled ?? DEFAULT_FORM_CONFIG.rsvpDisabled,
    fields: { ...DEFAULT_FORM_CONFIG.fields, ...stored.fields },
  };
}

export async function updateFormConfig(update: SettingsUpdate): Promise<FormConfig> {
  const current = await getFormConfig();
  const next: FormConfig = {
    rsvpDisabled: update.rsvpDisabled ?? current.rsvpDisabled,
    fields: { ...current.fields, ...update.fields },
  };
  await sql`
    insert into settings (key, value, updated_at)
    values (${FORM_CONFIG_KEY}, ${JSON.stringify(next)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return next;
}
