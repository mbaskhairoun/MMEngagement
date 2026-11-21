import { wedding } from "@/content/wedding";
import { COUNTRY, RECEPTION_TOWN } from "./constants";
import { Monogram } from "./Monogram";
import styles from "./Hero.module.css";

/** One seamless sine-like period repeated twice so the layer can loop by -50%. */
function wavePath(baseline: number, amplitude: number, height: number): string {
  const p = 1440;
  let d = `M0 ${baseline}`;
  for (let x = 0; x < p * 2; x += p) {
    d += ` C${x + p * 0.17} ${baseline - amplitude} ${x + p * 0.33} ${baseline - amplitude} ${x + p * 0.5} ${baseline}`;
    d += ` C${x + p * 0.67} ${baseline + amplitude} ${x + p * 0.83} ${baseline + amplitude} ${x + p} ${baseline}`;
  }
  return `${d} V${height} H0 Z`;
}

const LAYERS = [
  { d: wavePath(70, 26, 180), fill: "var(--sea-200)", opacity: 0.55, className: styles.layerBack },
  { d: wavePath(104, 20, 180), fill: "var(--sea-100)", opacity: 0.9, className: styles.layerMid },
  { d: wavePath(136, 14, 180), fill: "var(--cream-100)", opacity: 1, className: styles.layerFront },
];

export function Hero() {
  const { couple, date, rsvp } = wedding;
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.wash} aria-hidden="true" />
      <div className={styles.sun} aria-hidden="true" />

      <div className={styles.content}>
        <Monogram size={132} priority decorative className={styles.monogram} />
        <p className={`eyebrow ${styles.eyebrow}`}>The wedding of</p>

        <h1 id="hero-title" className={styles.names}>
          <span className={styles.name}>{couple.bride}</span>
          <span className={styles.amp}>&amp;</span>
          <span className={styles.name}>{couple.groom}</span>
        </h1>

        <div className={styles.meta}>
          <span className={styles.line} aria-hidden="true" />
          <p className={styles.date}>
            <span>{date.weekday}</span>
            <span className={styles.dot} aria-hidden="true" />
            <time dateTime={date.iso}>{date.display}</time>
          </p>
          <span className={styles.line} aria-hidden="true" />
        </div>

        <p className={styles.place}>
          {RECEPTION_TOWN}, {COUNTRY}
        </p>

        <div className={styles.actions}>
          <a href="#rsvp" className={styles.button}>
            RSVP
          </a>
          <p className={styles.deadline}>Kindly reply by {rsvp.deadlineDisplay}</p>
        </div>
      </div>

      <a href="#welcome" className={styles.cue}>
        <span>Scroll</span>
        <span className={styles.cueLine} aria-hidden="true" />
      </a>

      <div className={styles.waves} aria-hidden="true">
        {LAYERS.map((layer) => (
          <svg
            key={layer.d}
            className={`${styles.layer} ${layer.className}`}
            viewBox="0 0 2880 180"
            preserveAspectRatio="none"
            focusable="false"
          >
            <path d={layer.d} fill={layer.fill} opacity={layer.opacity} />
          </svg>
        ))}
      </div>
    </section>
  );
}
