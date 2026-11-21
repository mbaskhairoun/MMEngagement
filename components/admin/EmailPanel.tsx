"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, errMsg, formatDateTime, guestStatus } from "./api";
import type { EmailLog, EmailRecipient, Guest } from "./api";
import { Empty, PageHeader, useConfirm, useToast } from "./ui";

type Source = "all" | "attending" | "declined" | "pending" | "manual";
const BATCH = 10;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text becomes paragraphs; anything that looks like HTML is passed through. */
function bodyToHtml(body: string): string {
  if (/<\/?[a-z][\s\S]*>/i.test(body)) return body;
  return body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function personalize(html: string, name: string | undefined): string {
  const full = name?.trim() || "Friend";
  const first = full.split(/\s+/)[0] || "Friend";
  return html.replace(/\{\{\s*name\s*\}\}/gi, escapeHtml(full)).replace(/\{\{\s*first_name\s*\}\}/gi, escapeHtml(first));
}

function parseManual(text: string): EmailRecipient[] {
  const out: EmailRecipient[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const t = part.trim();
    if (!t) continue;
    const m = t.match(/^(.*?)\s*<([^>]+)>$/);
    const email = (m ? m[2] : t).trim();
    const name = m ? m[1].trim() : undefined;
    if (EMAIL_RE.test(email)) out.push({ email, name: name || undefined });
  }
  return out;
}

function dedupe(list: EmailRecipient[]): EmailRecipient[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const k = r.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function EmailPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [logs, setLogs] = useState<EmailLog[] | null>(null);
  const [source, setSource] = useState<Source>("all");
  const [manual, setManual] = useState("");
  const [subject, setSubject] = useState("");
  const [headerLabel, setHeaderLabel] = useState("A note from Marly & Michael");
  const [body, setBody] = useState("Hi {{first_name}},\n\n");
  const [footer, setFooter] = useState("");
  const [testTo, setTestTo] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ succeeded: number; failed: { email: string; error: string }[] } | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await adminApi.emailLogs(100));
    } catch (e) {
      if (!(e instanceof Error && e.message === "Unauthorized")) toast.error(errMsg(e));
      setLogs((l) => l ?? []);
    }
  }, [toast]);

  useEffect(() => {
    adminApi.guests().then(setGuests).catch((e) => toast.error(errMsg(e)));
    void loadLogs();
  }, [loadLogs, toast]);

  const recipients = useMemo<EmailRecipient[]>(() => {
    if (source === "manual") return dedupe(parseManual(manual));
    const list = guests
      .filter((g) => g.email && EMAIL_RE.test(g.email))
      .filter((g) => source === "all" || guestStatus(g) === source)
      .map((g) => ({ email: g.email as string, name: g.members[0] || g.invitationName }));
    return dedupe(list);
  }, [guests, source, manual]);

  const sending = progress !== null;
  const ready = subject.trim() && body.trim();

  function payload(to: EmailRecipient[]) {
    const html = bodyToHtml(body);
    return to.map((r) => ({
      to: [r],
      html: personalize(html, r.name),
    }));
  }

  async function sendBatch(to: EmailRecipient[]) {
    // Personalization is per-recipient, so each recipient gets its own html; send one request per batch
    // when no tokens are used, otherwise one call per recipient within the batch (in parallel).
    const usesTokens = /\{\{\s*(name|first_name)\s*\}\}/i.test(body);
    const common = {
      subject: subject.trim(),
      headerLabel: headerLabel.trim() || undefined,
      footerMessage: footer.trim() || undefined,
    };
    if (!usesTokens) return [await adminApi.sendEmail({ ...common, to, html: bodyToHtml(body) })];
    return Promise.all(payload(to).map((p) => adminApi.sendEmail({ ...common, to: p.to, html: p.html })));
  }

  async function send() {
    if (!ready || recipients.length === 0) return;
    const ok = await confirm({
      title: "Send email",
      message: <>Send &ldquo;{subject}&rdquo; to <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? "" : "s"}?</>,
      confirmLabel: "Send",
    });
    if (!ok) return;
    setResult(null);
    let succeeded = 0;
    const failed: { email: string; error: string }[] = [];
    setProgress({ done: 0, total: recipients.length });
    for (let i = 0; i < recipients.length; i += BATCH) {
      const chunk = recipients.slice(i, i + BATCH);
      try {
        const rs = await sendBatch(chunk);
        for (const r of rs) {
          succeeded += r.succeeded;
          failed.push(...(r.failed ?? []));
        }
      } catch (e) {
        if (e instanceof Error && e.message === "Unauthorized") {
          setProgress(null);
          return;
        }
        for (const r of chunk) failed.push({ email: r.email, error: errMsg(e) });
      }
      setProgress({ done: Math.min(i + BATCH, recipients.length), total: recipients.length });
    }
    setProgress(null);
    setResult({ succeeded, failed });
    if (failed.length) toast.error(`${failed.length} failed`);
    else toast.success(`Sent to ${succeeded}`);
    void loadLogs();
  }

  async function sendTest() {
    const email = testTo.trim();
    if (!EMAIL_RE.test(email)) return toast.error("Enter a valid test email");
    if (!ready) return toast.error("Add a subject and body first");
    try {
      const rs = await sendBatch([{ email, name: "Test" }]);
      const r = rs[0];
      if (r.failed?.length) toast.error(r.failed[0].error);
      else toast.success(`Test sent to ${email}`);
      void loadLogs();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <>
      <PageHeader title="Email guests" subtitle="Compose a message and send it to selected recipients." />
      <div className="adm-card adm-pad">
        <h2>Recipients</h2>
        <div className="adm-seg" role="group" aria-label="Recipients">
          {([
            ["all", "All with email"],
            ["attending", "Attending"],
            ["declined", "Declined"],
            ["pending", "Pending"],
            ["manual", "Manual list"],
          ] as const).map(([v, l]) => (
            <button key={v} className={source === v ? "active" : ""} onClick={() => setSource(v)}>{l}</button>
          ))}
        </div>
        {source === "manual" && (
          <label className="adm-field">
            <span>Emails (comma, semicolon or one per line; &ldquo;Name &lt;email&gt;&rdquo; works)</span>
            <textarea rows={4} value={manual} onChange={(e) => setManual(e.target.value)} />
          </label>
        )}
        <p className="adm-recipient-count"><strong>{recipients.length}</strong> unique recipient{recipients.length === 1 ? "" : "s"}</p>
      </div>
      <div className="adm-card adm-pad adm-form">
        <h2>Message</h2>
        <label className="adm-field"><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        <label className="adm-field"><span>Header label</span><input value={headerLabel} onChange={(e) => setHeaderLabel(e.target.value)} /></label>
        <label className="adm-field">
          <span>Body (plain text or HTML). Use {"{{first_name}}"} or {"{{name}}"} to personalize.</span>
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <label className="adm-field"><span>Footer message</span><input value={footer} onChange={(e) => setFooter(e.target.value)} /></label>
        <div className="adm-row">
          <input type="email" placeholder="Send test to…" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="adm-grow" />
          <button className="adm-btn" onClick={sendTest} disabled={sending}>Send test</button>
        </div>
        <div className="adm-send-row">
          <button className="adm-btn adm-btn-primary" onClick={send} disabled={sending || !ready || recipients.length === 0}>
            {sending ? `Sending ${progress?.done}/${progress?.total}` : `Send to ${recipients.length}`}
          </button>
          {progress && (
            <div className="adm-progress" aria-label="Progress">
              <div style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
          )}
        </div>
        {result && (
          <div className={`adm-result ${result.failed.length ? "adm-result-warn" : ""}`}>
            <strong>{result.succeeded} sent</strong>
            {result.failed.length > 0 && (
              <>, <strong>{result.failed.length} failed</strong>
                <ul>{result.failed.map((f, i) => <li key={`${f.email}-${i}`}>{f.email}: {f.error}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </div>
      <div className="adm-card">
        <div className="adm-card-title"><h2>Recent emails</h2><button className="adm-btn adm-btn-sm" onClick={loadLogs}>Refresh</button></div>
        {logs === null ? null : logs.length === 0 ? (
          <Empty>No emails sent yet.</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Sent</th><th>Type</th><th>Guest</th><th>Recipients</th><th>Result</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td data-label="Sent">{formatDateTime(l.sentAt)}</td>
                    <td data-label="Type">{l.type}</td>
                    <td data-label="Guest">{l.guestName || "—"}</td>
                    <td data-label="Recipients">{l.recipients.join(", ")}</td>
                    <td data-label="Result">
                      <span className={`adm-badge ${l.success ? "adm-badge-attending" : "adm-badge-declined"}`}>{l.success ? "Sent" : "Failed"}</span>
                      {l.error && <div className="adm-muted adm-small">{l.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
