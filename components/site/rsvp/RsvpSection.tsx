import { wedding } from "@/content/wedding";
import { Reveal } from "../Reveal";
import { SectionHeading } from "../SectionHeading";
import { RsvpFlow } from "./RsvpFlow";
import styles from "./Rsvp.module.css";

export function RsvpSection() {
  return (
    <section id="rsvp" className={styles.section} aria-labelledby="rsvp-title">
      <div className={styles.inner}>
        <Reveal>
          <SectionHeading
            id="rsvp-title"
            eyebrow="RSVP"
            title={
              <>
                Kindly <em>reply</em>
              </>
            }
            lede={`We would be honoured by your presence. Please respond by ${wedding.rsvp.deadlineDisplay}.`}
          />
        </Reveal>
        <Reveal delay={120}>
          <div className={styles.card}>
            <RsvpFlow />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
