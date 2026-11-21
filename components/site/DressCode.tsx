import { wedding } from "@/content/wedding";
import { Reveal } from "./Reveal";
import styles from "./DressCode.module.css";

const SWATCHES = [
  { name: "Sea glass", color: "var(--sea-200)" },
  { name: "Coastal blue", color: "var(--sea-300)" },
  { name: "Linen", color: "var(--cream-200)" },
  { name: "Sand", color: "var(--sand)" },
  { name: "Pearl", color: "var(--white)" },
];

export function DressCode() {
  const { dressCode } = wedding;
  return (
    <section id="attire" className={styles.section} aria-labelledby="attire-title">
      <Reveal className={styles.inner}>
        <p className="eyebrow">Dress code</p>
        <h2 id="attire-title" className={styles.title}>
          {dressCode.label}
        </h2>
        <p className={styles.detail}>{dressCode.detail}</p>

        <ul className={styles.palette} aria-label="Suggested colour palette">
          {SWATCHES.map((s, i) => (
            <li key={s.name} className={styles.swatch} style={{ ["--i" as string]: i }}>
              <span className={styles.chip} style={{ background: s.color }} aria-hidden="true" />
              <span className={styles.name}>{s.name}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
