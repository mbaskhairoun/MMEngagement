import { wedding } from "@/content/wedding";
import { ArchPhoto } from "./ArchPhoto";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import styles from "./Gallery.module.css";

const { bride, groom } = wedding.couple;

const PHOTOS = [
  {
    src: "/photos/photo-02.jpeg",
    alt: `${bride} and ${groom} embracing beneath twinkling winter lights`,
    focus: "50% 40%",
  },
  {
    src: "/photos/photo-05.jpeg",
    alt: `${bride} in a pale blue dress beside ${groom} in a light suit at a celebration`,
    focus: "50% 40%",
  },
  {
    src: "/photos/photo-01.jpeg",
    alt: `${bride} and ${groom} sharing a quiet moment on a garden balcony at dusk`,
    focus: "55% 45%",
  },
  {
    src: "/photos/photo-08.jpeg",
    alt: `${bride} and ${groom} dressed up and smiling at each other`,
    focus: "50% 45%",
  },
  {
    src: "/photos/photo-06.jpeg",
    alt: `${bride} and ${groom} on a terrace under a deep blue evening sky`,
    focus: "50% 55%",
  },
  {
    src: "/photos/photo-04.jpg",
    alt: `${bride} and ${groom} dressed in black for an evening out`,
    focus: "50% 40%",
  },
] as const;

export function Gallery() {
  return (
    <section id="gallery" className={styles.section} aria-labelledby="gallery-title">
      <div className={styles.inner}>
        <Reveal>
          <SectionHeading
            id="gallery-title"
            eyebrow="Gallery"
            title={
              <>
                A few of our <em>favourite moments</em>
              </>
            }
          />
        </Reveal>

        <ul className={styles.grid}>
          {PHOTOS.map((photo, i) => (
            <Reveal as="li" key={photo.src} className={styles.item} delay={i * 110}>
              <ArchPhoto
                src={photo.src}
                alt={photo.alt}
                aspect="3 / 4.4"
                focus={photo.focus}
                outline={i % 2 === 0 ? "left" : "right"}
                sizes="(min-width: 1200px) 360px, (min-width: 900px) 30vw, 46vw"
              />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
