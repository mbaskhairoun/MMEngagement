"use client";

import type { Pin } from "./api";
import { ICONS, Icon } from "./ui";

export function pinTitle(pin: Pin): string {
  return pin.title?.trim() || pin.description?.trim().slice(0, 80) || "Untitled pin";
}

/** One pin tile in a masonry column. Plain <img> keeps blob URLs out of next.config. */
export default function PinCard({
  pin,
  onOpen,
  selected,
  showLink = true,
  sectionTitle,
}: {
  pin: Pin;
  onOpen: (pin: Pin) => void;
  selected?: boolean;
  showLink?: boolean;
  sectionTitle?: string;
}) {
  const title = pinTitle(pin);
  const w = pin.width && pin.width > 0 ? pin.width : 600;
  const h = pin.height && pin.height > 0 ? pin.height : 800;
  return (
    <figure className={`dec-pin${selected ? " selected" : ""}`} style={{ backgroundColor: pin.dominantColor ?? undefined }}>
      <button type="button" className="dec-pin-hit" onClick={() => onOpen(pin)} aria-label={`Open ${title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pin.imageUrl} alt={title} width={w} height={h} loading="lazy" decoding="async" />
      </button>
      <figcaption className="dec-pin-over">
        <span className="dec-pin-title">{title}</span>
        {sectionTitle && <span className="dec-pin-section">{sectionTitle}</span>}
      </figcaption>
      {showLink && pin.pinUrl && (
        <a
          className="dec-pin-link"
          href={pin.pinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon d={ICONS.external} size={14} />
          <span>Open on Pinterest</span>
        </a>
      )}
      {selected && (
        <span className="dec-pin-check" aria-hidden="true">
          ✓
        </span>
      )}
    </figure>
  );
}
