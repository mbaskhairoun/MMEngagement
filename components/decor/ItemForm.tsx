"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ApiError, MAX_PHOTOS, STATUSES, STATUS_LABEL, decorApi, errMsg } from "./api";
import type { Item, ItemInput, ItemStatus, Photo, Pin, Section } from "./api";
import PhotoUploader, { makeQueued, uploadItemPhoto } from "./PhotoUploader";
import type { QueueStatus, QueuedPhoto } from "./PhotoUploader";
import { pinTitle } from "./PinCard";
import PinPicker from "./PinPicker";
import { Sheet, useConfirm, useToast } from "./ui";

export interface ItemPrefill {
  inspoPinId?: string | null;
  sectionId?: string | null;
}

const NAME_KEY = "mm_decor_name";
const NEW_SECTION = "__new";
const CURRENCIES = ["EGP", "USD", "EUR", "GBP", "AED", "SAR"];

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeName(v: string) {
  try {
    if (v) window.localStorage.setItem(NAME_KEY, v);
  } catch {
    /* storage unavailable */
  }
}

interface Fields {
  name: string;
  sectionId: string;
  inspoPinId: string;
  description: string;
  quantity: string;
  unit: string;
  estimatedCost: string;
  currency: string;
  status: ItemStatus;
  vendor: string;
  link: string;
  notes: string;
  addedBy: string;
}

function initialFields(item?: Item, prefill?: ItemPrefill): Fields {
  if (item) {
    return {
      name: item.name,
      sectionId: item.sectionId ?? "",
      inspoPinId: item.inspoPinId ?? "",
      description: item.description ?? "",
      quantity: String(item.quantity),
      unit: item.unit ?? "",
      estimatedCost: item.estimatedCost === null ? "" : String(item.estimatedCost),
      currency: item.currency || "EGP",
      status: item.status,
      vendor: item.vendor ?? "",
      link: item.link ?? "",
      notes: item.notes ?? "",
      addedBy: item.addedBy ?? "",
    };
  }
  return {
    name: "",
    sectionId: prefill?.sectionId ?? "",
    inspoPinId: prefill?.inspoPinId ?? "",
    description: "",
    quantity: "1",
    unit: "",
    estimatedCost: "",
    currency: "EGP",
    status: "proposed",
    vendor: "",
    link: "",
    notes: "",
    addedBy: "",
  };
}

type Phase = { step: "idle" } | { step: "saving" } | { step: "uploading"; done: number; total: number };

export default function ItemForm({
  item,
  prefill,
  sections,
  pins,
  onClose,
  onSaved,
  onDeleted,
  onSectionCreated,
  savedHint,
}: {
  item?: Item;
  prefill?: ItemPrefill;
  sections: Section[];
  pins: Pin[];
  onClose: () => void;
  /** Called after every server-side change; `done` means the form finished and should close. */
  onSaved: (item: Item, done: boolean) => void;
  onDeleted?: (id: string) => void;
  onSectionCreated: (s: Section) => void;
  savedHint?: ReactNode;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const initial = useMemo(() => initialFields(item, prefill), [item, prefill]);
  const [f, setF] = useState<Fields>(initial);
  const [baseline, setBaseline] = useState<Fields>(initial);
  const [savedItem, setSavedItem] = useState<Item | null>(item ?? null);
  const [photos, setPhotos] = useState<Photo[]>(item?.photos ?? []);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newSection, setNewSection] = useState<{ open: boolean; title: string; busy: boolean }>({
    open: false,
    title: "",
    busy: false,
  });
  const busy = phase.step !== "idle";
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Remember the decorator's name for new items.
  useEffect(() => {
    if (!item) {
      const n = readName();
      if (n) setF((x) => (x.addedBy ? x : { ...x, addedBy: n }));
    }
  }, [item]);

  // Free preview object URLs when the form goes away.
  useEffect(() => () => queueRef.current.forEach((q) => URL.revokeObjectURL(q.previewUrl)), []);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((x) => ({ ...x, [k]: v }));
  const pendingQueue = queue.filter((q) => q.status !== "done");
  const dirty = JSON.stringify(f) !== JSON.stringify(baseline) || pendingQueue.length > 0;
  const pin = f.inspoPinId ? pins.find((p) => p.id === f.inspoPinId) ?? null : null;
  const sortedSections = sections;

  async function requestClose() {
    if (busy) {
      const ok = await confirm({
        title: "Uploads in progress",
        message: "Closing now stops the remaining photo uploads. Photos already uploaded are kept.",
        confirmLabel: "Close anyway",
        danger: true,
      });
      if (!ok) return;
    } else if (dirty) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes to this item.",
        confirmLabel: "Discard",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }

  function buildBody(): ItemInput | string {
    const name = f.name.trim();
    if (!name) return "Give the item a name.";
    if (name.length > 120) return "Name must be 120 characters or fewer.";
    const qty = f.quantity.trim() === "" ? 1 : Number(f.quantity);
    if (!Number.isInteger(qty) || qty < 0) return "Quantity must be a whole number (0 or more).";
    let cost: number | null = null;
    if (f.estimatedCost.trim() !== "") {
      cost = Number(f.estimatedCost.replace(/,/g, ""));
      if (!Number.isFinite(cost) || cost < 0) return "Estimated cost must be a positive number.";
    }
    const currency = f.currency.trim().toUpperCase() || "EGP";
    if (!/^[A-Z]{3}$/.test(currency)) return "Currency must be a 3-letter code like EGP.";
    let link = f.link.trim();
    if (link) {
      if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
      try {
        new URL(link);
      } catch {
        return "The link doesn't look like a valid web address.";
      }
    }
    return {
      name,
      sectionId: f.sectionId || null,
      inspoPinId: f.inspoPinId || null,
      description: f.description.trim() || undefined,
      quantity: qty,
      unit: f.unit.trim() || undefined,
      estimatedCost: cost,
      currency,
      status: f.status,
      vendor: f.vendor.trim() || undefined,
      link: link || undefined,
      notes: f.notes.trim() || undefined,
      addedBy: f.addedBy.trim() || undefined,
    };
  }

  function patchQueue(key: string, status: QueueStatus, progress: number, err?: string) {
    setQueue((qs) => qs.map((q) => (q.key === key ? { ...q, status, progress, error: err } : q)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const body = buildBody();
    if (typeof body === "string") {
      setError(body);
      return;
    }
    setError("");
    writeName(f.addedBy.trim());

    // Step 1: save the item (create first so photos have an item to attach to).
    setPhase({ step: "saving" });
    let saved: Item;
    try {
      saved = savedItem ? await decorApi.updateItem(savedItem.id, body) : await decorApi.createItem(body);
    } catch (err) {
      setPhase({ step: "idle" });
      setError(errMsg(err));
      toast.error(errMsg(err));
      return;
    }
    const wasNew = !savedItem;
    setSavedItem(saved);
    setBaseline(f);
    let current: Item = { ...saved, photos: saved.photos?.length ? saved.photos : photos };
    setPhotos(current.photos);

    // Step 2: upload any queued photos, one at a time.
    const todo = queueRef.current.filter((q) => q.status === "queued" || q.status === "error");
    let failed = 0;
    if (todo.length) {
      let done = 0;
      setPhase({ step: "uploading", done, total: todo.length });
      for (const q of todo) {
        try {
          const photo = await uploadItemPhoto(saved.id, q.file, (status, progress) => patchQueue(q.key, status, progress));
          patchQueue(q.key, "done", 100);
          current = { ...current, photos: [...current.photos, photo] };
          setPhotos(current.photos);
        } catch (err) {
          failed += 1;
          const msg = err instanceof ApiError && err.code === "too_many_photos" ? `Max ${MAX_PHOTOS} photos` : errMsg(err);
          patchQueue(q.key, "error", 0, msg);
        }
        done += 1;
        setPhase({ step: "uploading", done, total: todo.length });
      }
      // Drop finished entries from the queue; they now live in `photos`.
      setQueue((qs) => {
        qs.filter((x) => x.status === "done").forEach((x) => URL.revokeObjectURL(x.previewUrl));
        return qs.filter((x) => x.status !== "done");
      });
    }
    setPhase({ step: "idle" });

    if (failed) {
      onSaved(current, false);
      const msg = `Item saved, but ${failed} of ${todo.length} photo${todo.length === 1 ? "" : "s"} failed. Tap Save to retry.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success(
      wasNew
        ? `“${saved.name}” added${todo.length ? ` with ${todo.length} photo${todo.length === 1 ? "" : "s"}` : ""}`
        : `“${saved.name}” saved`,
    );
    onSaved(current, true);
  }

  async function removeExisting(photo: Photo) {
    if (!savedItem) return;
    const ok = await confirm({
      title: "Remove photo?",
      message: "The photo will be deleted for everyone.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await decorApi.deletePhoto(savedItem.id, photo.id);
      const next = photos.filter((p) => p.id !== photo.id);
      setPhotos(next);
      onSaved({ ...savedItem, photos: next }, false);
      toast.success("Photo removed");
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  function removeQueued(key: string) {
    setQueue((qs) => {
      const hit = qs.find((q) => q.key === key);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return qs.filter((q) => q.key !== key);
    });
  }

  async function deleteItem() {
    if (!savedItem) return;
    const ok = await confirm({
      title: "Delete item?",
      message: (
        <>
          <strong>{savedItem.name}</strong> and its {photos.length} photo{photos.length === 1 ? "" : "s"} will be
          deleted permanently.
        </>
      ),
      confirmLabel: "Delete item",
      danger: true,
    });
    if (!ok) return;
    try {
      await decorApi.deleteItem(savedItem.id);
      toast.success(`“${savedItem.name}” deleted`);
      onDeleted?.(savedItem.id);
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function createSection() {
    const title = newSection.title.trim();
    if (!title) return;
    setNewSection((s) => ({ ...s, busy: true }));
    try {
      const s = await decorApi.createSection(title);
      onSectionCreated(s);
      set("sectionId", s.id);
      setNewSection({ open: false, title: "", busy: false });
      toast.success(`Category “${s.title}” created`);
    } catch (err) {
      setNewSection((s) => ({ ...s, busy: false }));
      toast.error(err instanceof ApiError && err.status === 409 ? "A category with that name already exists." : errMsg(err));
    }
  }

  const phaseText =
    phase.step === "saving"
      ? pendingQueue.length
        ? `Step 1 of 2 · Saving item…`
        : "Saving item…"
      : phase.step === "uploading"
        ? `Step 2 of 2 · Uploading ${Math.min(phase.done + 1, phase.total)}/${phase.total} photo${phase.total === 1 ? "" : "s"}…`
        : "";

  const footer = (
    <div className="dec-form-foot">
      {phaseText ? (
        <div className="dec-phase" role="status" aria-live="polite">
          <span className="dec-spinner" aria-hidden="true" />
          {phaseText}
        </div>
      ) : savedItem && onDeleted ? (
        <button type="button" className="dec-btn dec-btn-danger-ghost" onClick={() => void deleteItem()}>
          Delete
        </button>
      ) : (
        <span>{savedHint}</span>
      )}
      <div className="dec-form-foot-actions">
        <button type="button" className="dec-btn" onClick={() => void requestClose()}>
          {savedItem && !dirty ? "Close" : "Cancel"}
        </button>
        <button type="submit" form="dec-item-form" className="dec-btn dec-btn-primary" disabled={busy}>
          {busy ? "Saving…" : savedItem ? "Save" : pendingQueue.length ? `Add item + ${pendingQueue.length} photo${pendingQueue.length === 1 ? "" : "s"}` : "Add item"}
        </button>
      </div>
    </div>
  );

  return (
    <Sheet title={savedItem ? "Edit item" : "Add item"} onClose={() => void requestClose()} footer={footer}>
      <form id="dec-item-form" className="dec-form" onSubmit={submit} noValidate>
        {error && (
          <div className="dec-error" role="alert">
            {error}
          </div>
        )}

        <label className="dec-field">
          <span>Name *</span>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required autoFocus={!item} placeholder="e.g. Pampas centrepieces" />
        </label>

        <div className="dec-field">
          <label htmlFor="dec-section">Category</label>
          {newSection.open ? (
            <div className="dec-inline">
              <input
                value={newSection.title}
                onChange={(e) => setNewSection((s) => ({ ...s, title: e.target.value }))}
                placeholder="New category name"
                maxLength={80}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void createSection();
                  }
                }}
              />
              <button type="button" className="dec-btn dec-btn-primary" onClick={() => void createSection()} disabled={newSection.busy || !newSection.title.trim()}>
                {newSection.busy ? "Adding…" : "Add"}
              </button>
              <button type="button" className="dec-btn" onClick={() => setNewSection({ open: false, title: "", busy: false })}>
                Cancel
              </button>
            </div>
          ) : (
            <select
              id="dec-section"
              value={f.sectionId}
              onChange={(e) => {
                if (e.target.value === NEW_SECTION) setNewSection({ open: true, title: "", busy: false });
                else set("sectionId", e.target.value);
              }}
            >
              <option value="">No category</option>
              {sortedSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
              <option value={NEW_SECTION}>+ New category…</option>
            </select>
          )}
        </div>

        <label className="dec-field">
          <span>Description</span>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={2000} placeholder="Materials, colours, size, placement…" />
        </label>

        <div className="dec-form-row">
          <label className="dec-field">
            <span>Quantity</span>
            <input type="number" inputMode="numeric" min={0} step={1} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </label>
          <label className="dec-field">
            <span>Unit</span>
            <input value={f.unit} onChange={(e) => set("unit", e.target.value)} maxLength={30} placeholder="pcs, tables, m…" />
          </label>
        </div>

        <div className="dec-form-row">
          <label className="dec-field dec-grow">
            <span>Estimated cost (total)</span>
            <input type="text" inputMode="decimal" value={f.estimatedCost} onChange={(e) => set("estimatedCost", e.target.value)} placeholder="0" />
          </label>
          <label className="dec-field dec-currency">
            <span>Currency</span>
            <select value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              {(CURRENCIES.includes(f.currency) ? CURRENCIES : [f.currency, ...CURRENCIES]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="dec-field">
          <span className="dec-label">Status</span>
          <div className="dec-seg" role="radiogroup" aria-label="Status">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={f.status === s}
                className={`dec-seg-btn dec-status-${s}${f.status === s ? " active" : ""}`}
                onClick={() => set("status", s)}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="dec-form-row">
          <label className="dec-field">
            <span>Vendor</span>
            <input value={f.vendor} onChange={(e) => set("vendor", e.target.value)} maxLength={120} />
          </label>
          <label className="dec-field">
            <span>Link</span>
            <input type="url" inputMode="url" value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" />
          </label>
        </div>

        <label className="dec-field">
          <span>Notes</span>
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} maxLength={2000} />
        </label>

        <label className="dec-field">
          <span>Your name</span>
          <input value={f.addedBy} onChange={(e) => set("addedBy", e.target.value)} maxLength={80} autoComplete="name" placeholder="So the couple knows who suggested it" />
        </label>

        <div className="dec-field">
          <span className="dec-label">Inspired by</span>
          {pin ? (
            <div className="dec-inspired">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pin.imageUrl} alt="" width={pin.width ?? 60} height={pin.height ?? 80} />
              <span className="dec-inspired-title">{pinTitle(pin)}</span>
              <button type="button" className="dec-btn dec-btn-sm" onClick={() => setPickerOpen(true)}>
                Change
              </button>
              <button type="button" className="dec-btn dec-btn-sm" onClick={() => set("inspoPinId", "")}>
                Remove
              </button>
            </div>
          ) : (
            <button type="button" className="dec-btn" onClick={() => setPickerOpen(true)} disabled={pins.length === 0}>
              {pins.length === 0 ? "No pins to choose from" : "Choose a pin"}
            </button>
          )}
        </div>

        <div className="dec-field">
          <span className="dec-label">Photos</span>
          <PhotoUploader
            existing={photos}
            queue={queue}
            onAdd={(files) => setQueue((qs) => [...qs, ...files.map(makeQueued)])}
            onRemoveQueued={removeQueued}
            onRemoveExisting={(p) => void removeExisting(p)}
            onRejected={(m) => toast.error(m)}
            disabled={busy}
          />
        </div>
      </form>

      {pickerOpen && (
        <PinPicker
          pins={pins}
          sections={sections}
          selectedId={f.inspoPinId || null}
          initialSectionId={f.sectionId || null}
          onClose={() => setPickerOpen(false)}
          onPick={(p) => {
            set("inspoPinId", p.id);
            if (!f.sectionId && p.sectionId) set("sectionId", p.sectionId);
            setPickerOpen(false);
          }}
        />
      )}
    </Sheet>
  );
}
