"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { adminApi, errMsg } from "./api";
import type { Guest, GuestInput } from "./api";
import { Modal, downloadText, useConfirm, useToast } from "./ui";

const TEMPLATE = [
  "Invitation Name,Guest Name,Email,Notes",
  "The Smith Family,John Smith,smith@example.com,Vegetarian",
  "The Smith Family,Jane Smith,,",
  "Sarah Johnson,Sarah Johnson,sarah@example.com,",
].join("\n");

function cell(row: Record<string, unknown>, key: string): string {
  const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase());
  if (!found) return "";
  const v = row[found];
  return v === null || v === undefined ? "" : String(v).trim();
}

export function groupRows(rows: Record<string, unknown>[]): GuestInput[] {
  const map = new Map<string, GuestInput>();
  for (const r of rows) {
    const inv = cell(r, "Invitation Name");
    const guestName = cell(r, "Guest Name");
    if (!inv && !guestName) continue;
    const invitationName = inv || guestName;
    const key = invitationName.toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = { invitationName, members: [], email: undefined, notes: undefined };
      map.set(key, g);
    }
    if (guestName && !g.members.some((m) => m.toLowerCase() === guestName.toLowerCase())) g.members.push(guestName);
    const email = cell(r, "Email");
    if (email && !g.email) g.email = email;
    const notes = cell(r, "Notes");
    if (notes && !g.notes) g.notes = notes;
  }
  return [...map.values()];
}

export default function ImportModal({
  existing,
  onClose,
  onDone,
}: {
  existing: Guest[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [parsed, setParsed] = useState<GuestInput[]>([]);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);

  const existingNames = new Set(existing.map((g) => g.invitationName.trim().toLowerCase()));
  const newCount = parsed.filter((g) => !existingNames.has(g.invitationName.toLowerCase())).length;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const groups = groupRows(rows);
      if (!groups.length) toast.error("No rows found. Check the column headers.");
      setParsed(groups);
      setFileName(f.name);
    } catch (err) {
      toast.error(`Could not read file: ${errMsg(err)}`);
    }
  }

  async function run() {
    if (mode === "replace") {
      const ok = await confirm({
        title: "Replace entire guest list",
        message: <>This deletes all {existing.length} existing guests and imports {parsed.length} from the file. This cannot be undone.</>,
        confirmLabel: "Replace all",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await adminApi.importGuests(mode, parsed);
      toast.success(`Imported ${r.added} guests${r.skipped ? `, skipped ${r.skipped}` : ""}`);
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import guests" onClose={onClose}>
      <p className="adm-muted">
        Upload an .xlsx or .csv with columns <code>Invitation Name</code>, <code>Guest Name</code>, <code>Email</code>,{" "}
        <code>Notes</code>. Rows sharing an invitation name become one household.
      </p>
      <div className="adm-row">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
        <button className="adm-btn adm-btn-sm" onClick={() => downloadText("guest-import-template.csv", TEMPLATE)}>
          Download template
        </button>
      </div>
      {parsed.length > 0 && (
        <>
          <p>
            <strong>{fileName}</strong>: {parsed.length} invitations ({newCount} new, {parsed.length - newCount} already exist)
          </p>
          <div className="adm-table-wrap adm-preview">
            <table className="adm-table">
              <thead>
                <tr><th>Invitation</th><th>Members</th><th>Email</th><th>Notes</th><th>Status</th></tr>
              </thead>
              <tbody>
                {parsed.map((g) => {
                  const exists = existingNames.has(g.invitationName.toLowerCase());
                  return (
                    <tr key={g.invitationName}>
                      <td data-label="Invitation">{g.invitationName}</td>
                      <td data-label="Members">{g.members.join(", ")}</td>
                      <td data-label="Email">{g.email}</td>
                      <td data-label="Notes">{g.notes}</td>
                      <td data-label="Status">
                        <span className={`adm-badge ${exists ? "adm-badge-pending" : "adm-badge-attending"}`}>
                          {exists ? "Exists" : "New"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="adm-radios">
            <label>
              <input type="radio" name="mode" checked={mode === "append"} onChange={() => setMode("append")} /> Append (skip
              invitations that already exist)
            </label>
            <label>
              <input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace
              (delete everything first)
            </label>
          </div>
        </>
      )}
      <div className="adm-modal-actions">
        <button className="adm-btn" onClick={onClose}>Cancel</button>
        <button className="adm-btn adm-btn-primary" disabled={!parsed.length || busy} onClick={run}>
          {busy ? "Importing…" : `Import ${parsed.length || ""}`}
        </button>
      </div>
    </Modal>
  );
}
