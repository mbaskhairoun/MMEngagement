import { wedding } from "@/content/wedding";
import { ArchPhoto } from "./ArchPhoto";
import { Reveal } from "./Reveal";
import styles from "./Welcome.module.css";

export function Welcome() {
  const { couple, date, events } = wedding;
  const [ceremony, reception] = events;

  return (
    <section id="welcome" className={styles.section} aria-labelledby="welcome-title">
      <div className={styles.inner}>
        <Reveal className={styles.media}>
          <ArchPhoto
            src="/photos/photo-03.jpeg"
            alt={`${couple.bride} and ${couple.groom} laughing together on a stone balcony at golden hour`}
            aspect="3 / 4"
            sizes="(min-width: 900px) 36vw, (min-width: 600px) 60vw, 82vw"
            focus="50% 30%"
            outline="left"
          />
        </Reveal>

        <Reveal className={styles.copy} delay={120}>
          <p className={styles.script}>together with their families</p>
          <h2 id="welcome-title" className={styles.title}>
            We&rsquo;re getting <em>married</em>
          </h2>
          <p className={styles.body}>
            {couple.bride} and {couple.groom} joyfully invite you to share in the day they become
            one. We will exchange our vows at {ceremony.venue} on {date.weekday}, {date.display},
            then carry the celebration to the shore of the Red Sea for an evening of dinner,
            dancing and golden light at {reception.venue}.
          </p>
          <p className={styles.body}>
            Your love has shaped our story, and it would mean the world to have you beside us as
            the next chapter begins.
          </p>

          <figure className={styles.verse}>
            <blockquote>
              <p>&ldquo;I found the one whom my soul loves.&rdquo;</p>
            </blockquote>
            <figcaption>Song of Solomon 3:4</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
