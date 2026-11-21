import styles from "./SectionHeading.module.css";

type Props = {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "center" | "start";
};

/** Eyebrow label, display heading and an optional lede with a hairline ornament. */
export function SectionHeading({ id, eyebrow, title, lede, align = "center" }: Props) {
  return (
    <header className={`${styles.head} ${align === "start" ? styles.start : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      <span className={styles.rule} aria-hidden="true">
        <span />
        <svg viewBox="0 0 24 12" width="24" height="12">
          <path
            d="M1 6c2.5 0 2.5-3 5.5-3S9 6 12 6s3-3 5.5-3S20.5 6 23 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
        <span />
      </span>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
    </header>
  );
}
