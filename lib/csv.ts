import type { RsvpAdmin } from "@/lib/db";

type Cell = string | number | boolean | null | undefined;

/** Quotes every cell and neutralises spreadsheet formula injection. */
export function csvCell(value: Cell): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  // BOM so Excel opens UTF-8 (accented and Arabic names) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const yesNo = (v: boolean) => (v ? "Yes" : "No");
const list = (v: string[]) => v.join("; ");

export function rsvpsCsvByHousehold(rsvps: RsvpAdmin[]): string {
  return toCsv(
    [
      "Invitation", "Submitted By", "Email", "Phone", "Attending", "Attending Members", "Declined Members",
      "Total Attending", "Events", "Relationship", "Meal Preference", "Dietary Restrictions", "Children Count",
      "Children Ages", "Song Request", "Transport Needed", "Accommodation Needed", "Special Requests", "Message",
      "Submitted", "Updated",
    ],
    rsvps.map((r) => [
      r.invitationName, r.fullName, r.email, r.phone, yesNo(r.attending), list(r.attendingMembers),
      list(r.declinedMembers), r.totalAttending, list(r.events), r.relationship, r.mealPreference,
      r.dietaryRestrictions, r.childrenCount, r.childrenAges, r.songRequest, yesNo(r.transportNeeded),
      yesNo(r.accommodationNeeded), r.specialRequests, r.message, r.createdAt, r.updatedAt,
    ]),
  );
}

/** One row per attending individual. */
export function rsvpsCsvByMember(rsvps: RsvpAdmin[]): string {
  return toCsv(
    ["Guest Name", "Invitation", "Email", "Phone", "Events", "Meal Preference", "Dietary Restrictions", "Submitted"],
    rsvps
      .filter((r) => r.attending)
      .flatMap((r) =>
        r.attendingMembers.map((member) => {
          const isSubmitter = member.toLowerCase() === r.fullName.toLowerCase();
          return [
            member, r.invitationName, r.memberEmails[member] ?? (isSubmitter ? r.email : ""),
            isSubmitter ? r.phone : "", list(r.events), r.mealPreference, r.dietaryRestrictions, r.createdAt,
          ];
        }),
      ),
  );
}
