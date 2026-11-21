import Image from "next/image";
import styles from "./ArchPhoto.module.css";

type Props = {
  src: string;
  alt: string;
  /** CSS aspect-ratio for the frame, e.g. "3 / 4". */
  aspect?: string;
  sizes: string;
  priority?: boolean;
  /** Which way the thin offset outline sits. */
  outline?: "left" | "right";
  /** object-position for the crop. */
  focus?: string;
  className?: string;
};

/** Photo in a rounded-top arch with a thin, offset hairline frame. */
export function ArchPhoto({
  src,
  alt,
  aspect = "3 / 4",
  sizes,
  priority = false,
  outline = "right",
  focus = "50% 35%",
  className,
}: Props) {
  return (
    <figure
      className={[styles.frame, outline === "left" ? styles.left : styles.right, className]
        .filter(Boolean)
        .join(" ")}
      style={{ aspectRatio: aspect }}
    >
      <div className={styles.clip}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={styles.img}
          style={{ objectPosition: focus }}
        />
      </div>
    </figure>
  );
}
