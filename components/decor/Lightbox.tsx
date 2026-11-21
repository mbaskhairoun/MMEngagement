"use client";

import { useEffect, useState } from "react";
import { decorApi, errMsg, formatDay } from "./api";
import type { Pin, Section } from "./api";
import { pinTitle } from "./PinCard";
import { ICONS, Icon, Modal, useToast } from "./ui";

export default function Lightbox({
  pins,
  index,
  sections,
  onClose,
  onNavigate,
  onMoved,
  onAddToSelections,
}: {
  pins: Pin[];
  index: number;
  sections: Section[];
  onClose: () => void;
  onNavigate: (index: number) => void;
  onMoved: (pin: Pin) => void;
  onAddToSelections: (pin: Pin) => void;
}) {
  const toast = useToast();
  const pin = pins[index];
  const [moving, setMoving] = useState(false);
  const hasPrev = index > 0;
  const hasNext = index < pins.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "SELECT" || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, hasPrev, hasNext, onNavigate]);

  if (!pin) return null;
  const title = pinTitle(pin);

  async function move(sectionId: string) {
    const next = sectionId || null;
    if (next === pin.sectionId) return;
    setMoving(true);
    try {
      const updated = await decorApi.movePin(pin.id, next);
      onMoved(updated);
      const name = sections.find((s) => s.id === next)?.title ?? "Uncategorised";
      toast.success(`Moved to ${name}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setMoving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="dec-lightbox">
        <div className="dec-lightbox-media" style={{ backgroundColor: pin.dominantColor ?? undefined }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={pin.id}
            src={pin.imageUrl}
            alt={title}
            width={pin.width ?? undefined}
            height={pin.height ?? undefined}
          />
          {hasPrev && (
            <button
              type="button"
              className="dec-lightbox-nav prev"
              onClick={() => onNavigate(index - 1)}
              aria-label="Previous pin"
            >
              <Icon d={ICONS.left} size={22} />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              className="dec-lightbox-nav next"
              onClick={() => onNavigate(index + 1)}
              aria-label="Next pin"
            >
              <Icon d={ICONS.right} size={22} />
            </button>
          )}
        </div>
        <div className="dec-lightbox-meta">
          <p className="dec-muted dec-small">
            {index + 1} of {pins.length}
            {pin.pinnedAt ? ` · pinned ${formatDay(pin.pinnedAt)}` : ""}
          </p>
          <h2 className="dec-lightbox-title">{title}</h2>
          {pin.description && pin.description.trim() !== title && (
            <p className="dec-lightbox-desc">{pin.description}</p>
          )}
          <label className="dec-field">
            <span>Category</span>
            <select value={pin.sectionId ?? ""} onChange={(e) => void move(e.target.value)} disabled={moving}>
              <option value="">Uncategorised</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <small className="dec-muted">To keep a pin in a category, move it on Pinterest.</small>
          </label>
          <div className="dec-lightbox-actions">
            <button type="button" className="dec-btn dec-btn-primary dec-btn-block" onClick={() => onAddToSelections(pin)}>
              <Icon d={ICONS.plus} />
              Add to selections
            </button>
            {pin.pinUrl && (
              <a className="dec-btn dec-btn-block" href={pin.pinUrl} target="_blank" rel="noopener noreferrer">
                <Icon d={ICONS.external} />
                Open on Pinterest
              </a>
            )}
            {pin.link && (
              <a className="dec-link dec-small" href={pin.link} target="_blank" rel="noopener noreferrer">
                Source: {safeHost(pin.link)}
              </a>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
