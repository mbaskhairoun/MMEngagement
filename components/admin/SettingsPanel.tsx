"use client";

import { useEffect, useState } from "react";
import { adminApi, errMsg } from "./api";
import type { FieldKey, Settings } from "./api";
import { PageHeader, Spinner, useToast } from "./ui";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "phone", label: "Phone number" },
  { key: "relationship", label: "Relationship to the couple" },
  { key: "mealPreference", label: "Meal preference" },
  { key: "dietary", label: "Dietary restrictions" },
  { key: "childrenCount", label: "Children count and ages" },
  { key: "songRequest", label: "Song request" },
  { key: "transportNeeded", label: "Transport needed" },
  { key: "accommodationNeeded", label: "Accommodation needed" },
  { key: "specialRequests", label: "Special requests" },
  { key: "message", label: "Message to the couple" },
];

export default function SettingsPanel() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .settings()
      .then((s) => setSettings({ rsvpDisabled: s.rsvpDisabled, fields: s.fields }))
      .catch((e) => toast.error(errMsg(e)));
  }, [toast]);

  async function save(next: Settings, msg: string) {
    const prev = settings;
    setSettings(next);
    setSaving(true);
    try {
      const r = await adminApi.saveSettings(next);
      setSettings({ rsvpDisabled: r.rsvpDisabled, fields: r.fields });
      toast.success(msg);
    } catch (e) {
      setSettings(prev);
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <><PageHeader title="Settings" /><Spinner /></>;

  return (
    <>
      <PageHeader title="Form settings" subtitle="Control the public RSVP form." />
      <div className="adm-card adm-pad">
        <h2>RSVP status</h2>
        <label className="adm-switch">
          <input
            type="checkbox"
            checked={!settings.rsvpDisabled}
            disabled={saving}
            onChange={(e) => save({ ...settings, rsvpDisabled: !e.target.checked }, e.target.checked ? "RSVP opened" : "RSVP closed")}
          />
          <span className="adm-switch-track" />
          <span>{settings.rsvpDisabled ? "RSVP is closed" : "RSVP is open"}</span>
        </label>
      </div>
      <div className="adm-card adm-pad">
        <h2>Visible fields</h2>
        <p className="adm-muted">Name, email and attendance are always shown. Choose which optional questions guests see.</p>
        <div className="adm-checks">
          {FIELDS.map((f) => (
            <label key={f.key}>
              <input
                type="checkbox"
                checked={settings.fields[f.key] ?? false}
                disabled={saving}
                onChange={(e) =>
                  save({ ...settings, fields: { ...settings.fields, [f.key]: e.target.checked } }, "Settings saved")
                }
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
