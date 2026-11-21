import { sql, toEmailLog, type EmailLog, type EmailLogRow } from "@/lib/db";

export type EmailLogType = "rsvp_confirmed" | "rsvp_updated" | "broadcast";

export type EmailLogEntry = {
  guestId?: string | null;
  guestName?: string | null;
  type: EmailLogType;
  recipients: string[];
  success: boolean;
  statusCode?: number | null;
  error?: string | null;
};

/** Never throws: a logging failure must not break the email or RSVP flow. */
export async function writeEmailLog(entry: EmailLogEntry): Promise<void> {
  try {
    await sql`
      insert into email_logs (guest_id, guest_name, type, recipients, success, status_code, error)
      values (${entry.guestId ?? null}, ${entry.guestName ?? null}, ${entry.type}, ${entry.recipients},
              ${entry.success}, ${entry.statusCode ?? null}, ${entry.error?.slice(0, 2000) ?? null})`;
  } catch (err) {
    console.error("[mail] failed to write email log:", err);
  }
}

export async function listEmailLogs(limit: number): Promise<EmailLog[]> {
  const rows = (await sql`select * from email_logs order by sent_at desc limit ${limit}`) as EmailLogRow[];
  return rows.map(toEmailLog);
}
