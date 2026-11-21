"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ApiError, decorApi, errMsg, formatDay, plural } from "./api";
import type { InspoData, Item, Pin, Section } from "./api";
import ItemForm from "./ItemForm";
import type { ItemPrefill } from "./ItemForm";
import Lightbox from "./Lightbox";
import PinCard from "./PinCard";
import { Empty, ErrorBox, ICONS, Icon, Modal, Spinner, useToast } from "./ui";

const ALL = "__all";
const NONE = "__none";

export default function InspirationPanel() {
  const toast = useToast();
  const [data, setData] = useState<InspoData | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>(ALL);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [prefill, setPrefill] = useState<ItemPrefill | null>(null);
  const [syncing, setSyncing] = useState<"" | "quick" | "full">("");
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await decorApi.inspo());
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => data?.sections ?? [], [data]);
  const pins = useMemo(() => data?.pins ?? [], [data]);
  const sectionTitle = useMemo(() => new Map(sections.map((s) => [s.id, s.title])), [sections]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pins) {
      const k = p.sectionId && sectionTitle.has(p.sectionId) ? p.sectionId : NONE;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [pins, sectionTitle]);

  const visible = useMemo(() => {
    if (filter === ALL) return pins;
    if (filter === NONE) return pins.filter((p) => !p.sectionId || !sectionTitle.has(p.sectionId));
    return pins.filter((p) => p.sectionId === filter);
  }, [pins, filter, sectionTitle]);

  // Keep the chip valid if its section disappears after a reload.
  useEffect(() => {
    if (filter !== ALL && filter !== NONE && data && !sectionTitle.has(filter)) setFilter(ALL);
  }, [filter, data, sectionTitle]);

  async function sync(full: boolean) {
    setSyncing(full ? "full" : "quick");
    setInfoOpen(false);
    try {
      const r = await decorApi.sync(full);
      if (r.dispatched) {
        toast.info("Full sync started. New pins and categories appear in a few minutes.");
      } else if ((r.added ?? 0) > 0) {
        toast.success(`Added ${plural(r.added ?? 0, "new pin")}`);
        await load();
      } else {
        toast.info("Up to date");
        await load();
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSyncing("");
    }
  }

  const onMoved = useCallback((pin: Pin) => {
    setData((d) => (d ? { ...d, pins: d.pins.map((p) => (p.id === pin.id ? { ...p, ...pin } : p)) } : d));
  }, []);

  function onSectionCreated(s: Section) {
    setData((d) => (d ? { ...d, sections: [...d.sections, s] } : d));
  }

  // If a move takes the open pin out of the current filter, close or clamp the lightbox.
  useEffect(() => {
    if (openIndex === null) return;
    if (visible.length === 0) setOpenIndex(null);
    else if (openIndex >= visible.length) setOpenIndex(visible.length - 1);
  }, [visible, openIndex]);

  if (error && !data) {
    return (
      <div className="dec-page">
        <ErrorBox message={error} onRetry={() => void load()} />
      </div>
    );
  }
  if (!data) return <Spinner label="Loading inspiration" />;

  const sync$ = data.sync;
  const pinCount = pins.length;
  const syncedOn = formatDay(sync$?.lastSyncedAt);

  return (
    <div className="dec-page">
      <div className="dec-page-head">
        <div>
          <div className="dec-eyebrow">Pinterest board</div>
          <h1>Inspiration</h1>
          <p className="dec-muted dec-stats-line">
            {plural(pinCount, "pin")} · {plural(sections.length, "category", "categories")}
            {syncedOn ? ` · synced ${syncedOn}` : " · not synced yet"}
          </p>
        </div>
        <div className="dec-page-actions">
          <button type="button" className="dec-btn" onClick={() => setNewCatOpen(true)}>
            <Icon d={ICONS.plus} />
            New category
          </button>
          <div className="dec-sync-group">
            <button
              type="button"
              className="dec-btn dec-btn-primary"
              onClick={() => void sync(false)}
              disabled={syncing !== ""}
            >
              <Icon d={ICONS.sync} />
              {syncing === "quick" ? "Syncing…" : "Sync from Pinterest"}
            </button>
            <InfoTip open={infoOpen} setOpen={setInfoOpen}>
              <p>
                <strong>Sync from Pinterest</strong> quickly adds pins that are new on the board into
                &ldquo;New from Pinterest&rdquo;.
              </p>
              <p>
                A full sync runs automatically every night and files each pin into its Pinterest section. To keep a
                pin in a category, move it on Pinterest.
              </p>
              <button
                type="button"
                className="dec-btn dec-btn-sm"
                onClick={() => void sync(true)}
                disabled={syncing !== ""}
              >
                {syncing === "full" ? "Starting…" : "Run a full sync now"}
              </button>
            </InfoTip>
          </div>
        </div>
      </div>

      {pinCount === 0 ? (
        <div className="dec-card">
          <Empty
            title="No pins yet"
            action={
              <button
                type="button"
                className="dec-btn dec-btn-primary"
                onClick={() => void sync(true)}
                disabled={syncing !== ""}
              >
                <Icon d={ICONS.sync} />
                {syncing ? "Syncing…" : "Run the first sync"}
              </button>
            }
          >
            Pins from the couple&rsquo;s Pinterest board will appear here, grouped by category.
          </Empty>
        </div>
      ) : (
        <>
          <div className="dec-chips" role="group" aria-label="Categories">
            <Chip active={filter === ALL} onClick={() => setFilter(ALL)} label="All" count={pinCount} />
            {sections.map((s) => (
              <Chip
                key={s.id}
                active={filter === s.id}
                onClick={() => setFilter(s.id)}
                label={s.title}
                count={counts.get(s.id) ?? 0}
              />
            ))}
            {(counts.get(NONE) ?? 0) > 0 && (
              <Chip
                active={filter === NONE}
                onClick={() => setFilter(NONE)}
                label="Uncategorised"
                count={counts.get(NONE) ?? 0}
              />
            )}
          </div>

          {visible.length === 0 ? (
            <div className="dec-card">
              <Empty title="Nothing in this category yet">
                Open any pin and pick this category to move it here.
              </Empty>
            </div>
          ) : (
            <div className="dec-masonry">
              {visible.map((p, i) => (
                <PinCard
                  key={p.id}
                  pin={p}
                  onOpen={() => setOpenIndex(i)}
                  sectionTitle={filter === ALL && p.sectionId ? sectionTitle.get(p.sectionId) : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {openIndex !== null && visible[openIndex] && (
        <Lightbox
          pins={visible}
          index={openIndex}
          sections={sections}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          onMoved={onMoved}
          onAddToSelections={(p) => {
            setOpenIndex(null);
            setPrefill({ inspoPinId: p.id, sectionId: p.sectionId });
          }}
        />
      )}

      {prefill && (
        <ItemForm
          prefill={prefill}
          sections={sections}
          pins={pins}
          onClose={() => setPrefill(null)}
          onSectionCreated={onSectionCreated}
          onSaved={(_item: Item, done: boolean) => {
            if (done) setPrefill(null);
          }}
          savedHint={
            <Link href="/winners/selections" className="dec-link">
              View selections
            </Link>
          }
        />
      )}

      {newCatOpen && (
        <NewCategoryModal
          onClose={() => setNewCatOpen(false)}
          onCreated={(s) => {
            onSectionCreated(s);
            setNewCatOpen(false);
            setFilter(s.id);
            toast.success(`Category “${s.title}” created`);
          }}
        />
      )}
    </div>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} className={`dec-chip${active ? " active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <span className="dec-chip-count">{count}</span>
    </button>
  );
}

function InfoTip({
  open,
  setOpen,
  children,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return (
    <div className="dec-info" ref={ref}>
      <button
        type="button"
        className="dec-btn dec-btn-icon"
        aria-label="How syncing works"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon d={ICONS.info} />
      </button>
      {open && (
        <div className="dec-info-pop" role="dialog" aria-label="How syncing works">
          {children}
        </div>
      )}
    </div>
  );
}

export function NewCategoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Section) => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      onCreated(await decorApi.createSection(t));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "A category with that name already exists." : errMsg(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="New category" onClose={onClose} small>
      <form onSubmit={submit}>
        <label className="dec-field">
          <span>Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} autoFocus required placeholder="e.g. Welcome sign" />
        </label>
        {error && (
          <div className="dec-error" role="alert">
            {error}
          </div>
        )}
        <div className="dec-modal-actions">
          <button type="button" className="dec-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="dec-btn dec-btn-primary" disabled={busy || !title.trim()}>
            {busy ? "Creating…" : "Create category"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
