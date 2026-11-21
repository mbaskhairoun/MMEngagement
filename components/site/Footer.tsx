import Link from "next/link";
import { wedding } from "@/content/wedding";
import { Monogram } from "./Monogram";
import styles from "./Footer.module.css";

export function Footer() {
  const { couple, date } = wedding;
  return (
    <footer className={styles.footer}>
      <svg className={styles.wave} viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 20c120 0 120-12 240-12s120 12 240 12 120-12 240-12 120 12 240 12 120-12 240-12 120 12 240 12"
          fill="none"
          stroke="var(--sea-300)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <Monogram size={64} decorative className={styles.monogram} />
      <p className={styles.script}>With love</p>
      <p className={styles.names}>
        {couple.bride} <span>&amp;</span> {couple.groom}
      </p>
      <p className={styles.date}>
        <time dateTime={date.iso}>{date.display}</time>
      </p>
      <nav className={styles.nav} aria-label="Footer">
        <a href="#the-day">The day</a>
        <a href="#travel">Travel</a>
        <a href="#rsvp">RSVP</a>
        <Link href="/admin" className={styles.admin}>
          Admin
        </Link>
      </nav>
    </footer>
  );
}
