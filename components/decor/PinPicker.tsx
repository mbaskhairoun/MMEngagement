"use client";

import { useMemo, useState } from "react";
import type { Pin, Section } from "./api";
import PinCard, { pinTitle } from "./PinCard";
import { Empty, Modal } from "./ui";

/** Small modal to choose the pin an item was inspired by. */
export default function PinPicker({
  pins,
  sections,
  selectedId,
  initialSectionId,
  onPick,
  onClose,
}: {
  pins: Pin[];
  sections: Section[];
  selectedId: string | null;
  initialSectionId?: string | null;
  onPick: (pin: Pin) => void;
  onClose: () => void;
}) {
  const [sectionId, setSectionId] = useState<string>(initialSectionId ?? "");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pins.filter((p) => {
      if (sectionId && p.sectionId !== sectionId) return false;
      if (!needle) return true;
      return `${pinTitle(p)} ${p.description ?? ""}`.toLowerCase().includes(needle);
    });
  }, [pins, sectionId, q]);

  return (
    <Modal title="Inspired by…" onClose={onClose} wide layer="top">
      <div className="dec-picker-bar">
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search pins" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pins" />
      </div>
      {visible.length === 0 ? (
        <Empty title="No pins match">Try another category or search.</Empty>
      ) : (
        <div className="dec-masonry dec-masonry-picker">
          {visible.map((p) => (
            <PinCard key={p.id} pin={p} onOpen={onPick} selected={p.id === selectedId} showLink={false} />
          ))}
        </div>
      )}
    </Modal>
  );
}
