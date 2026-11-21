"use client";

import { STATUSES, STATUS_LABEL, formatMoney } from "./api";
import type { Item, ItemStatus } from "./api";
import { ICONS, Icon } from "./ui";

export default function ItemCard({
  item,
  sectionTitle,
  onOpen,
  onStatus,
  statusBusy,
}: {
  item: Item;
  sectionTitle?: string;
  onOpen: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
  statusBusy?: boolean;
}) {
  const photo = item.photos[0];
  const img = photo?.url ?? item.pin?.imageUrl ?? null;
  const qty = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
  return (
    <article className={`dec-item dec-item-${item.status}`}>
      <button type="button" className="dec-item-hit" onClick={() => onOpen(item)} aria-label={`Edit ${item.name}`}>
        <div className="dec-item-media">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" loading="lazy" decoding="async" width={photo?.width ?? 400} height={photo?.height ?? 300} />
          ) : (
            <span className="dec-item-noimg">
              <Icon d={ICONS.image} size={28} />
            </span>
          )}
          {item.photos.length > 1 && <span className="dec-item-count">{item.photos.length} photos</span>}
          {!photo && item.pin && <span className="dec-item-count">Inspiration</span>}
        </div>
        <div className="dec-item-body">
          {sectionTitle && <div className="dec-item-cat">{sectionTitle}</div>}
          <h3 className="dec-item-name">{item.name}</h3>
          <div className="dec-item-meta">
            <span>Qty {qty}</span>
            {item.estimatedCost !== null && <span className="dec-item-cost">{formatMoney(item.estimatedCost, item.currency)}</span>}
          </div>
          {item.addedBy && <div className="dec-item-by">Added by {item.addedBy}</div>}
        </div>
      </button>
      <div className="dec-item-foot">
        <label className="visually-hidden" htmlFor={`st-${item.id}`}>
          Status for {item.name}
        </label>
        <select
          id={`st-${item.id}`}
          className={`dec-status-select dec-status-${item.status}`}
          value={item.status}
          disabled={statusBusy}
          onChange={(e) => onStatus(item, e.target.value as ItemStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {item.link && (
          <a className="dec-btn dec-btn-sm dec-btn-ghost" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`Open link for ${item.name}`}>
            <Icon d={ICONS.external} size={14} />
            Link
          </a>
        )}
      </div>
    </article>
  );
}
