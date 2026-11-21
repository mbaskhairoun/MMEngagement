import { wedding, type WeddingEventId } from "@/content/wedding";
import { CalendarIcon, ChurchIcon, PinIcon, WavesIcon } from "./Icons";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { googleCalendarUrl } from "./time";
import styles from "./TheDay.module.css";

const ICONS: Record<WeddingEventId, typeof ChurchIcon> = {
  ceremony: ChurchIcon,
  reception: WavesIcon,
};

export function TheDay() {
  const { date, events } = wedding;

  return (
    <section id="the-day" className={styles.section} aria-labelledby="day-title">
      <div className={styles.inner}>
        <Reveal>
          <SectionHeading
            id="day-title"
            eyebrow="The day"
            title={
              <>
                From the altar <em>to the sea</em>
              </>
            }
            lede={`${date.weekday}, ${date.display}. All times are Cairo time.`}
          />
        </Reveal>

        <ol className={styles.timeline}>
          {events.map((event, i) => {
            const Icon = ICONS[event.id];
            return (
              <Reveal as="li" key={event.id} className={styles.item} delay={i * 120}>
                <span className={styles.node} aria-hidden="true">
                  <Icon size={30} />
                </span>
                <article className={styles.card} aria-labelledby={`event-${event.id}`}>
                  <p className={styles.time}>
                    <time dateTime={`${date.iso}T${event.startLocal}`}>{event.startDisplay}</time>
                  </p>
                  <p className={`eyebrow ${styles.kind}`}>{event.kind}</p>
                  <h3 id={`event-${event.id}`} className={styles.name}>
                    {event.name}
                  </h3>
                  <p className={styles.venue}>{event.venue}</p>
                  <p className={styles.area}>{event.area}</p>
                  <p className={styles.note}>{event.note}</p>
                  <a
                    className={styles.mapLink}
                    href={event.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <PinIcon size={18} />
                    <span>Open in Maps</span>
                    <span className="visually-hidden"> for {event.venue} (opens in a new tab)</span>
                  </a>
                </article>
              </Reveal>
            );
          })}
        </ol>

        <Reveal className={styles.calendar} delay={150}>
          <p className={styles.calendarLabel}>
            <CalendarIcon size={22} />
            <span>Save the date</span>
          </p>
          <div className={styles.calendarLinks}>
            <a className={styles.calButton} href="/api/calendar.ics" download>
              Apple &amp; Outlook
            </a>
            <a
              className={styles.calButton}
              href={googleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Calendar
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
