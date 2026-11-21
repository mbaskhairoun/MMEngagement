import Image from "next/image";
import { wedding } from "@/content/wedding";
import { CEREMONY_TOWN, RECEPTION_TOWN } from "./constants";
import { BreezeIcon, CarIcon, ClockIcon, SunsetIcon } from "./Icons";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import styles from "./TravelStay.module.css";

/** Drive time and departure advice for the afternoon transfer to the coast. */
const DRIVE_MINUTES = 90;
const LEAVE_BY = "2:45 PM";

export function TravelStay() {
  const [ceremony, reception] = wedding.events;

  const cards = [
    {
      icon: CarIcon,
      title: "Getting there",
      body: (
        <>
          From {CEREMONY_TOWN}, {RECEPTION_TOWN} is about {DRIVE_MINUTES} minutes by car along the
          Cairo&ndash;Sokhna road, with the desert giving way to the sea in the final stretch.
          Carpooling with family and friends makes the drive part of the celebration.
        </>
      ),
    },
    {
      icon: SunsetIcon,
      title: "Where to stay",
      body: (
        <>
          We warmly suggest staying the night at {reception.venue}, so the party is a short walk
          from your room and the morning after begins with the sea. If you would like a hand with
          accommodation or transport, simply let us know in your RSVP.
        </>
      ),
    },
    {
      icon: BreezeIcon,
      title: "What to pack",
      body: (
        <>
          Light layers for a beach evening: the breeze picks up after sunset, so bring a wrap or a
          light jacket. Sunglasses for the golden hour, shoes that are happy on grass and sand, and
          perhaps a fresh change for after the drive.
        </>
      ),
    },
  ];

  return (
    <section id="travel" className={styles.section} aria-labelledby="travel-title">
      <div className={styles.backdrop} aria-hidden="true">
        <Image
          src="/photos/photo-07.jpeg"
          alt=""
          fill
          sizes="100vw"
          className={styles.backdropImg}
        />
      </div>
      <div className={styles.inner}>
        <Reveal>
          <SectionHeading
            id="travel-title"
            eyebrow="Travel & stay"
            title={
              <>
                A little <em>help along the way</em>
              </>
            }
            lede={`The ceremony is in ${ceremony.area}; the reception is on the Red Sea coast at ${RECEPTION_TOWN}. Here is everything you need for an easy afternoon between the two.`}
          />
        </Reveal>

        <Reveal className={styles.tip} delay={80}>
          <span className={styles.tipIcon} aria-hidden="true">
            <ClockIcon size={26} />
          </span>
          <p>
            <span className={styles.tipLabel}>Our one tip</span>
            Leave the church by <strong>{LEAVE_BY}</strong> to arrive relaxed for the reception at{" "}
            {reception.startDisplay}.
          </p>
        </Reveal>

        <ul className={styles.grid}>
          {cards.map(({ icon: Icon, title, body }, i) => (
            <Reveal as="li" key={title} className={styles.card} delay={120 + i * 120}>
              <span className={styles.icon} aria-hidden="true">
                <Icon size={34} />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
