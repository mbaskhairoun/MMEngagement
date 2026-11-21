"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EXPORT_URL, STATUSES, STATUS_LABEL, decorApi, errMsg, formatMoney, plural } from "./api";
import type { Item, ItemStatus, Pin, Section } from "./api";
import ItemCard from "./ItemCard";
import ItemForm from "./ItemForm";
import { Empty, ErrorBox, ICONS, Icon, Spinner, useToast } from "./ui";

type Editing = { kind: "new" } | { kind: "edit"; item: Item } | null;

export default function SelectionsPanel() {
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [error, setError] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "">("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [statusBusy, setStatusBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError("");
    try {
      const [its, inspo] = await Promise.all([
        decorApi.items(),
        decorApi.inspo().catch(() => null), // selections still work if the board can't load
      ]);
      setItems(its);
      if (inspo) {
        setSections(inspo.sections);
        setPins(inspo.pins);
      }
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sectionTitle = useMemo(() => new Map(sections.map((s) => [s.id, s.title])), [sections]);

  const summary = useMemo(() => {
    const counts: Record<ItemStatus, number> = { proposed: 0, approved: 0, ordered: 0, declined: 0 };
    const totals = new Map<string, number>();
    for (const it of items ?? []) {
      counts[it.status] += 1;
      if (it.status !== "declined" && it.estimatedCost !== null) {
        totals.set(it.currency, (totals.get(it.currency) ?? 0) + it.estimatedCost);
      }
    }
    return { counts, totals: [...totals.entries()].sort((a, b) => b[1] - a[1]) };
  }, [items]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((it) => {
      if (sectionFilter === "__none" ? it.sectionId : sectionFilter && it.sectionId !== sectionFilter) return false;
      if (statusFilter && it.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = [it.name, it.description, it.vendor, it.notes, it.addedBy, it.unit, it.sectionId ? sectionTitle.get(it.sectionId) : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, sectionFilter, statusFilter, q, sectionTitle]);

  const upsert = useCallback((item: Item) => {
    setItems((list) => {
      if (!list) return [item];
      const i = list.findIndex((x) => x.id === item.id);
      if (i === -1) return [item, ...list];
      const next = list.slice();
      next[i] = item;
      return next;
    });
  }, []);

  async function changeStatus(item: Item, status: ItemStatus) {
    if (status === item.status) return;
    const prev = item.status;
    upsert({ ...item, status });
    setStatusBusy((s) => new Set(s).add(item.id));
    try {
      const updated = await decorApi.setStatus(item.id, status);
      upsert({ ...item, ...updated, photos: updated.photos ?? item.photos, pin: updated.pin ?? item.pin });
      toast.success(`“${item.name}” marked ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) {
      upsert({ ...item, status: prev });
      toast.error(errMsg(e));
    } finally {
      setStatusBusy((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  }

  if (error && !items) {
    return (
      <div className="dec-page">
        <ErrorBox message={error} onRetry={() => void load()} />
      </div>
    );
  }
  if (!items) return <Spinner label="Loading selections" />;

  const filtered = sectionFilter !== "" || statusFilter !== "" || q.trim() !== "";

  return (
    <div className="dec-page">
      <div className="dec-page-head">
        <div>
          <div className="dec-eyebrow">Proposals &amp; choices</div>
          <h1>Selections</h1>
          <p className="dec-muted dec-stats-line">{plural(items.length, "item")}</p>
        </div>
        <div className="dec-page-actions">
          <a className="dec-btn" href={EXPORT_URL} download>
            <Icon d={ICONS.download} />
            Export CSV
          </a>
          <button type="button" className="dec-btn dec-btn-primary" onClick={() => setEditing({ kind: "new" })}>
            <Icon d={ICONS.plus} />
            Add item
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="dec-summary">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`dec-summary-stat dec-status-${s}${statusFilter === s ? " active" : ""}`}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              aria-pressed={statusFilter === s}
            >
              <span className="dec-summary-value">{summary.counts[s]}</span>
              <span className="dec-summary-label">{STATUS_LABEL[s]}</span>
            </button>
          ))}
          <div className="dec-summary-stat dec-summary-total">
            <span className="dec-summary-value">
              {summary.totals.length === 0
                ? "—"
                : summary.totals.map(([cur, amt]) => (
                    <span key={cur} className="dec-summary-money">
                      {formatMoney(amt, cur)}
                    </span>
                  ))}
            </span>
            <span className="dec-summary-label">Estimated total (excl. declined)</span>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="dec-filters">
          <div className="dec-search">
            <Icon d={ICONS.search} />
            <input type="search" placeholder="Search items, vendors, notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
          </div>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            <option value="__none">No category</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ItemStatus | "")} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {filtered && (
            <button
              type="button"
              className="dec-btn dec-btn-ghost"
              onClick={() => {
                setSectionFilter("");
                setStatusFilter("");
                setQ("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="dec-card">
          <Empty
            title="No selections yet"
            action={
              <button type="button" className="dec-btn dec-btn-primary" onClick={() => setEditing({ kind: "new" })}>
                <Icon d={ICONS.plus} />
                Add the first item
              </button>
            }
          >
            Add the pieces you&rsquo;re proposing, with photos, quantities and costs. Marly and Michael can approve them here.
          </Empty>
        </div>
      ) : visible.length === 0 ? (
        <div className="dec-card">
          <Empty title="No items match these filters" />
        </div>
      ) : (
        <div className="dec-item-grid">
          {visible.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              sectionTitle={it.sectionId ? sectionTitle.get(it.sectionId) : undefined}
              onOpen={(item) => setEditing({ kind: "edit", item })}
              onStatus={(item, s) => void changeStatus(item, s)}
              statusBusy={statusBusy.has(it.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ItemForm
          key={editing.kind === "edit" ? editing.item.id : "new"}
          item={editing.kind === "edit" ? editing.item : undefined}
          prefill={editing.kind === "new" && sectionFilter && sectionFilter !== "__none" ? { sectionId: sectionFilter } : undefined}
          sections={sections}
          pins={pins}
          onClose={() => setEditing(null)}
          onSaved={(item, done) => {
            upsert(item);
            if (done) setEditing(null);
          }}
          onDeleted={(id) => setItems((list) => (list ? list.filter((x) => x.id !== id) : list))}
          onSectionCreated={(s) => setSections((list) => [...list, s])}
        />
      )}
    </div>
  );
}
