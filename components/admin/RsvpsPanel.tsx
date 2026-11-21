"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EXPORT_BY_MEMBER_URL, EXPORT_URL, adminApi, errMsg, formatDateTime } from "./api";
import type { Rsvp } from "./api";
import { Empty, Modal, PageHeader, Spinner, StatCard, StatusBadge, useConfirm, useToast } from "./ui";

function yn(v: boolean | null): string {
  return v === null ? "" : v ? "Yes" : "No";
}

function Detail({ rsvp }: { rsvp: Rsvp }) {
  const rows: [string, string][] = [
    ["Invitation", rsvp.invitationName],
    ["Email", rsvp.email],
    ["Phone", rsvp.phone ?? ""],
    ["Attending", rsvp.attendingMembers.join(", ")],
    ["Declined", rsvp.declinedMembers.join(", ")],
    ["Events", rsvp.events.join(", ")],
    ["Relationship", rsvp.relationship ?? ""],
    ["Meal", rsvp.mealPreference ?? ""],
    ["Dietary", rsvp.dietaryRestrictions ?? ""],
    ["Children", rsvp.childrenCount ? `${rsvp.childrenCount}${rsvp.childrenAges ? ` (ages ${rsvp.childrenAges})` : ""}` : ""],
    ["Song request", rsvp.songRequest ?? ""],
    ["Transport needed", yn(rsvp.transportNeeded)],
    ["Accommodation needed", yn(rsvp.accommodationNeeded)],
    ["Special requests", rsvp.specialRequests ?? ""],
    ["Message", rsvp.message ?? ""],
    ["Submitted", formatDateTime(rsvp.createdAt)],
    ["Updated", formatDateTime(rsvp.updatedAt)],
  ];
  const memberEmails = Object.entries(rsvp.memberEmails ?? {});
  return (
    <dl className="adm-dl">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      {memberEmails.length > 0 && (
        <div>
          <dt>Member emails</dt>
          <dd>{memberEmails.map(([n, e]) => `${n}: ${e}`).join("; ")}</dd>
        </div>
      )}
    </dl>
  );
}

export default function RsvpsPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rsvps, setRsvps] = useState<Rsvp[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Rsvp | null>(null);

  const load = useCallback(async () => {
    try {
      setRsvps(await adminApi.rsvps());
    } catch (e) {
      if (!(e instanceof Error && e.message === "Unauthorized")) toast.error(errMsg(e));
      setRsvps((r) => r ?? []);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const list = rsvps ?? [];
    const att = list.filter((r) => r.attending);
    return {
      total: list.length,
      attending: att.length,
      declined: list.length - att.length,
      headcount: att.reduce((n, r) => n + r.attendingMembers.length + (r.childrenCount ?? 0), 0),
    };
  }, [rsvps]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rsvps ?? [];
    return (rsvps ?? []).filter((r) =>
      [r.invitationName, r.fullName, r.email, r.message ?? "", ...r.attendingMembers].some((s) => s.toLowerCase().includes(q)),
    );
  }, [rsvps, query]);

  async function remove(r: Rsvp) {
    const ok = await confirm({
      title: "Delete RSVP",
      message: <>Delete the RSVP from <strong>{r.fullName}</strong> ({r.invitationName})? The guest will return to Pending.</>,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteRsvp(r.id);
      toast.success("RSVP deleted");
      setOpen(null);
      void load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <>
      <PageHeader
        title="RSVP responses"
        actions={
          <>
            <a className="adm-btn" href={EXPORT_URL} download>Export CSV</a>
            <a className="adm-btn" href={EXPORT_BY_MEMBER_URL} download>Export by person</a>
          </>
        }
      />
      <div className="adm-stats">
        <StatCard label="Responses" value={stats.total} />
        <StatCard label="Attending" value={stats.attending} />
        <StatCard label="Declined" value={stats.declined} />
        <StatCard label="Headcount" value={stats.headcount} hint="attending guests + children" />
      </div>
      <div className="adm-card">
        <div className="adm-toolbar">
          <input className="adm-search" type="search" placeholder="Search responses" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {rsvps === null ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <Empty>{rsvps.length === 0 ? "No RSVPs yet." : "No responses match your search."}</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Invitation</th><th>Contact</th><th>Status</th><th>Party</th><th>Meal</th><th>Submitted</th>
                  <th className="adm-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Invitation"><strong>{r.invitationName}</strong><div className="adm-muted adm-small">{r.fullName}</div></td>
                    <td data-label="Contact">{r.email}{r.phone && <div className="adm-muted adm-small">{r.phone}</div>}</td>
                    <td data-label="Status"><StatusBadge status={r.attending ? "attending" : "declined"} /></td>
                    <td data-label="Party">{r.attending ? r.attendingMembers.length + (r.childrenCount ?? 0) : "—"}</td>
                    <td data-label="Meal">{r.mealPreference || "—"}</td>
                    <td data-label="Submitted">{formatDateTime(r.createdAt)}</td>
                    <td className="adm-td-actions">
                      <button className="adm-btn adm-btn-sm" onClick={() => setOpen(r)}>Details</button>
                      <button className="adm-btn adm-btn-sm adm-btn-danger-ghost" onClick={() => remove(r)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <Modal title={open.fullName} onClose={() => setOpen(null)}>
          <Detail rsvp={open} />
        </Modal>
      )}
    </>
  );
}
