"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { adminApi, errMsg, formatDate, guestStatus } from "./api";
import type { Guest, GuestInput } from "./api";
import ImportModal from "./ImportModal";
import { Empty, Modal, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "./ui";

type Filter = "all" | "responded" | "pending";

function GuestForm({ guest, onClose, onSaved }: { guest: Guest | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(guest?.invitationName ?? "");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [members, setMembers] = useState((guest?.members ?? []).join("\n"));
  const [notes, setNotes] = useState(guest?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: GuestInput = {
      invitationName: name.trim(),
      email: email.trim() || undefined,
      members: members.split("\n").map((m) => m.trim()).filter(Boolean),
      notes: notes.trim() || undefined,
    };
    if (!body.invitationName) return;
    setBusy(true);
    try {
      if (guest) await adminApi.updateGuest(guest.id, body);
      else await adminApi.createGuest(body);
      toast.success(guest ? "Guest updated" : "Guest added");
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={guest ? "Edit guest" : "Add guest"} onClose={onClose}>
      <form onSubmit={submit} className="adm-form">
        <label className="adm-field">
          <span>Invitation name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Smith Family" required autoFocus />
        </label>
        <label className="adm-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="adm-field">
          <span>Household members (one per line)</span>
          <textarea rows={4} value={members} onChange={(e) => setMembers(e.target.value)} />
        </label>
        <label className="adm-field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function GuestsPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Guest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    try {
      setGuests(await adminApi.guests());
    } catch (e) {
      if (!(e instanceof Error && e.message === "Unauthorized")) toast.error(errMsg(e));
      setGuests((g) => g ?? []);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (guests ?? []).filter((g) => {
      if (filter === "responded" && !g.hasRsvped) return false;
      if (filter === "pending" && g.hasRsvped) return false;
      if (!q) return true;
      return [g.invitationName, g.email ?? "", g.notes ?? "", ...g.members].some((s) => s.toLowerCase().includes(q));
    });
  }, [guests, query, filter]);

  async function remove(g: Guest) {
    const ok = await confirm({
      title: "Delete guest",
      message: <>Delete <strong>{g.invitationName}</strong>? Any RSVP linked to this invitation may be affected. This cannot be undone.</>,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteGuest(g.id);
      toast.success("Guest deleted");
      void load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const total = guests?.length ?? 0;
  const responded = (guests ?? []).filter((g) => g.hasRsvped).length;

  return (
    <>
      <PageHeader
        title="Guest list"
        subtitle={guests ? `${total} invitations · ${responded} responded · ${total - responded} pending` : undefined}
        actions={
          <>
            <button className="adm-btn" onClick={() => setShowImport(true)}>Import</button>
            <button className="adm-btn adm-btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
              Add guest
            </button>
          </>
        }
      />
      <div className="adm-card">
        <div className="adm-toolbar">
          <input
            className="adm-search"
            type="search"
            placeholder="Search name, email, member, notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="adm-seg" role="group" aria-label="Filter">
            {(["all", "responded", "pending"] as const).map((f) => (
              <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {guests === null ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <Empty>{total === 0 ? "No guests yet. Add one or import a spreadsheet." : "No guests match your search."}</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Invitation</th>
                  <th>Members</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th className="adm-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Invitation">
                      <strong>{g.invitationName}</strong>
                      {g.notes && <div className="adm-muted adm-small">{g.notes}</div>}
                    </td>
                    <td data-label="Members">{g.members.length ? g.members.join(", ") : <span className="adm-muted">&mdash;</span>}</td>
                    <td data-label="Email">{g.email || <span className="adm-muted">&mdash;</span>}</td>
                    <td data-label="Status">
                      <StatusBadge status={guestStatus(g)} />
                      {g.attending && <span className="adm-muted adm-small"> {g.totalAttending} going</span>}
                    </td>
                    <td data-label="Added">{formatDate(g.createdAt)}</td>
                    <td className="adm-td-actions">
                      <button className="adm-btn adm-btn-sm" onClick={() => { setEditing(g); setShowForm(true); }}>Edit</button>
                      <button className="adm-btn adm-btn-sm adm-btn-danger-ghost" onClick={() => remove(g)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showForm && (
        <GuestForm
          guest={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
      {showImport && (
        <ImportModal
          existing={guests ?? []}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); void load(); }}
        />
      )}
    </>
  );
}
