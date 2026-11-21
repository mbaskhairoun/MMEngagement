import { wedding } from "@/content/wedding";
import { CountdownClock } from "./CountdownClock";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { ceremonyStart, eventEnd } from "./time";
import styles from "./Countdown.module.css";

export function Countdown() {
  const { date, events } = wedding;
  const target = ceremonyStart().getTime();
  const end = eventEnd(events[events.length - 1]).getTime();

  return (
    <section className={styles.section} aria-labelledby="countdown-title">
      <div className={styles.inner}>
        <Reveal>
          <SectionHeading
            id="countdown-title"
            eyebrow="Counting down"
            title={
              <>
                Until we say <em>I do</em>
              </>
            }
            lede={
              <>
                {date.weekday}, {date.display} at {events[0].startDisplay}, Cairo time
              </>
            }
          />
        </Reveal>
        <Reveal delay={150}>
          <CountdownClock target={target} end={end} />
        </Reveal>
      </div>
    </section>
  );
}
