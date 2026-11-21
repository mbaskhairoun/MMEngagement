import type { ReactNode } from "react";
import styles from "./SiteShell.module.css";

/** Public-site wrapper: skip link, grain overlay and the main landmark. */
export function SiteShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <main id="main" className={styles.main}>
        {children}
      </main>
      {footer}
      <div className={styles.grain} aria-hidden="true" />
    </div>
  );
}
