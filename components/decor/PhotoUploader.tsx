"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { MAX_PHOTOS, UPLOAD_URL, decorApi } from "./api";
import type { Photo } from "./api";
import { ICONS, Icon } from "./ui";

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.86;
const PASS_THROUGH_BYTES = 2.5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export type QueueStatus = "queued" | "preparing" | "uploading" | "saving" | "done" | "error";

export interface QueuedPhoto {
  key: string;
  file: File;
  previewUrl: string;
  status: QueueStatus;
  progress: number;
  error?: string;
}

let keySeq = 0;
export function makeQueued(file: File): QueuedPhoto {
  keySeq += 1;
  return {
    key: `q${Date.now()}-${keySeq}`,
    file,
    previewUrl: URL.createObjectURL(file),
    status: "queued",
    progress: 0,
  };
}

function isHeic(file: File): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function isAcceptable(file: File): boolean {
  return /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|webp|hei[cf])$/i.test(file.name);
}

function extFor(type: string, name: string): string {
  if (/jpe?g/i.test(type)) return "jpg";
  if (/png/i.test(type)) return "png";
  if (/webp/i.test(type)) return "webp";
  if (/hei[cf]/i.test(type)) return "heic";
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode_failed"));
    img.src = src;
  });
}

interface Prepared {
  blob: Blob;
  contentType: string;
  ext: string;
  width?: number;
  height?: number;
}

/** Downscale to MAX_EDGE as JPEG. HEIC (which canvas usually can't decode) and undecodable files go up as-is. */
export async function prepareImage(file: File): Promise<Prepared> {
  const original: Prepared = {
    blob: file,
    contentType: isHeic(file) ? "image/heic" : file.type || "image/jpeg",
    ext: extFor(file.type, file.name),
  };
  if (isHeic(file)) return original;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return original;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    if (scale === 1 && file.size <= PASS_THROUGH_BYTES) return { ...original, width: w, height: h };

    const tw = Math.round(w * scale);
    const th = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ...original, width: w, height: h };
    ctx.fillStyle = "#ffffff"; // flatten transparency before JPEG
    ctx.fillRect(0, 0, tw, th);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, tw, th);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return { ...original, width: w, height: h };
    return { blob, contentType: "image/jpeg", ext: "jpg", width: tw, height: th };
  } catch {
    return original;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Resize → client upload to Blob → register with the item. */
export async function uploadItemPhoto(
  itemId: string,
  file: File,
  onPhase: (status: QueueStatus, progress: number) => void,
): Promise<Photo> {
  onPhase("preparing", 0);
  const prepared = await prepareImage(file);
  if (prepared.blob.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 15 MB");
  onPhase("uploading", 0);
  const blob = await upload(`decor/${itemId}/${uuid()}.${prepared.ext}`, prepared.blob, {
    access: "public",
    handleUploadUrl: UPLOAD_URL,
    contentType: prepared.contentType,
    clientPayload: JSON.stringify({ itemId }),
    multipart: prepared.blob.size > 8 * 1024 * 1024,
    onUploadProgress: (e) => onPhase("uploading", Math.round(e.percentage)),
  });
  onPhase("saving", 100);
  return decorApi.addPhoto(itemId, {
    url: blob.url,
    pathname: blob.pathname,
    width: prepared.width,
    height: prepared.height,
  });
}

/* ---------- UI ---------- */

const STATUS_TEXT: Record<QueueStatus, string> = {
  queued: "Ready",
  preparing: "Resizing…",
  uploading: "Uploading",
  saving: "Saving…",
  done: "Uploaded",
  error: "Failed",
};

export default function PhotoUploader({
  existing,
  queue,
  onAdd,
  onRemoveQueued,
  onRemoveExisting,
  onRejected,
  disabled,
}: {
  existing: Photo[];
  queue: QueuedPhoto[];
  onAdd: (files: File[]) => void;
  onRemoveQueued: (key: string) => void;
  onRemoveExisting: (photo: Photo) => void;
  onRejected: (message: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pending = queue.filter((q) => q.status !== "done");
  const used = existing.length + pending.length;
  const remaining = Math.max(0, MAX_PHOTOS - used);

  function accept(list: FileList | File[] | null) {
    if (!list) return;
    const files = Array.from(list);
    const ok = files.filter(isAcceptable);
    const bad = files.length - ok.length;
    const tooBig = ok.filter((f) => f.size > MAX_UPLOAD_BYTES && isHeic(f));
    const usable = ok.filter((f) => !tooBig.includes(f));
    const taken = usable.slice(0, remaining);
    const msgs: string[] = [];
    if (bad) msgs.push(`${bad} file${bad === 1 ? " isn't" : "s aren't"} a supported image (JPEG, PNG, WebP, HEIC)`);
    if (tooBig.length) msgs.push(`${tooBig.length} HEIC file${tooBig.length === 1 ? " is" : "s are"} over 15 MB`);
    if (usable.length > taken.length) msgs.push(`Only ${MAX_PHOTOS} photos per item, so ${usable.length - taken.length} were skipped`);
    if (msgs.length) onRejected(msgs.join(". "));
    if (taken.length) onAdd(taken);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    accept(e.dataTransfer.files);
  }

  return (
    <div className="dec-photos">
      {(existing.length > 0 || queue.length > 0) && (
        <ul className="dec-photo-grid">
          {existing.map((p) => (
            <li key={p.id} className="dec-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" width={p.width ?? 200} height={p.height ?? 200} loading="lazy" />
              <button
                type="button"
                className="dec-photo-remove"
                onClick={() => onRemoveExisting(p)}
                aria-label="Remove photo"
                disabled={disabled}
              >
                &times;
              </button>
            </li>
          ))}
          {queue.map((q) => (
            <QueuedThumb key={q.key} q={q} onRemove={() => onRemoveQueued(q.key)} disabled={disabled} />
          ))}
        </ul>
      )}
      <div
        className={`dec-drop${dragging ? " dragging" : ""}${disabled || remaining === 0 ? " disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon d={ICONS.image} size={22} />
        <div>
          <button
            type="button"
            className="dec-btn dec-btn-sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || remaining === 0}
          >
            Choose photos
          </button>
          <span className="dec-drop-or"> or drag them here</span>
        </div>
        <span className="dec-muted dec-small">
          {remaining === 0 ? `Maximum of ${MAX_PHOTOS} photos reached` : `${used}/${MAX_PHOTOS} · large photos are resized automatically`}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            accept(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function QueuedThumb({ q, onRemove, disabled }: { q: QueuedPhoto; onRemove: () => void; disabled?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [q.previewUrl]);
  const busy = q.status === "preparing" || q.status === "uploading" || q.status === "saving";
  return (
    <li className={`dec-photo dec-photo-${q.status}`} title={q.error ?? q.file.name}>
      {broken ? (
        <span className="dec-photo-placeholder">
          <Icon d={ICONS.image} />
          <span>{q.file.name}</span>
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.previewUrl} alt="" onError={() => setBroken(true)} />
      )}
      <span className="dec-photo-status">
        {STATUS_TEXT[q.status]}
        {q.status === "uploading" ? ` ${q.progress}%` : ""}
      </span>
      {(q.status === "uploading" || q.status === "saving") && (
        <span className="dec-photo-bar" aria-hidden="true">
          <span style={{ width: `${q.progress}%` }} />
        </span>
      )}
      {!busy && q.status !== "done" && (
        <button type="button" className="dec-photo-remove" onClick={onRemove} aria-label="Remove photo" disabled={disabled}>
          &times;
        </button>
      )}
    </li>
  );
}
