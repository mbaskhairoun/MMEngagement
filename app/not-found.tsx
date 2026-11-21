import Link from "next/link";
import { wedding } from "@/content/wedding";
import { Monogram } from "@/components/site/Monogram";
import styles from "@/components/site/NotFound.module.css";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.wash} aria-hidden="true" />
      <div className={styles.content}>
        <Monogram size={96} decorative className={styles.monogram} />
        <p className="eyebrow">Page not found</p>
        <h1 className={styles.title}>
          This path has <em>drifted out to sea</em>
        </h1>
        <p className={styles.body}>
          The page you were looking for isn&rsquo;t here. Everything you need for {wedding.date.display} is
          waiting on the main page.
        </p>
        <Link href="/" className={styles.button}>
          Back to {wedding.couple.display}
        </Link>
      </div>
      <svg className={styles.waves} viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 62C240 22 480 22 720 54s480 42 720 6v60H0z" fill="var(--sea-200)" opacity="0.45" />
        <path d="M0 82c200-26 420-34 640-12s460 30 800 6v44H0z" fill="var(--sea-100)" />
        <path d="M0 96c260-18 520-22 760-6s460 18 680 4v26H0z" fill="var(--cream-100)" />
      </svg>
    </main>
  );
}
