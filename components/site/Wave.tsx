import styles from "./Wave.module.css";

type Props = {
  /** Colour of the section above the divider. */
  top: string;
  /** Colour of the section below — the front wave is filled with it. */
  bottom: string;
  /** Mirror horizontally so stacked dividers don't repeat. */
  flip?: boolean;
  /** Draw a hairline crest in sea-300 along the front wave. */
  crest?: boolean;
  className?: string;
};

/** Soft, layered wave divider drawn between two sections. */
export function Wave({ top, bottom, flip = false, crest = true, className }: Props) {
  return (
    <div
      className={[styles.wave, className].filter(Boolean).join(" ")}
      style={{ background: top }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className={flip ? styles.flip : undefined}
        focusable="false"
      >
        <path
          d="M0 62C240 22 480 22 720 54s480 42 720 6v60H0z"
          fill={bottom}
          opacity="0.32"
        />
        <path
          d="M0 82c200-26 420-34 640-12s460 30 800 6v44H0z"
          fill={bottom}
          opacity="0.6"
        />
        <path d="M0 96c260-18 520-22 760-6s460 18 680 4v26H0z" fill={bottom} />
        {crest ? (
          <path
            d="M0 96c260-18 520-22 760-6s460 18 680 4"
            fill="none"
            stroke="var(--sea-300)"
            strokeOpacity="0.55"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}
