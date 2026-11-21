import Image from "next/image";
import { wedding } from "@/content/wedding";

type Tone = "sea" | "ink" | "cream";

const SOURCES: Record<Tone, string> = {
  sea: "/logo-sea.png",
  ink: "/logo-ink.png",
  cream: "/logo-cream.png",
};

type Props = {
  size: number;
  tone?: Tone;
  priority?: boolean;
  className?: string;
  /** Decorative when the couple's names are already adjacent. */
  decorative?: boolean;
};

/** The couple's calligraphy monogram, pre-tinted into the palette. */
export function Monogram({ size, tone = "sea", priority = false, className, decorative = false }: Props) {
  return (
    <Image
      src={SOURCES[tone]}
      width={size}
      height={size}
      alt={decorative ? "" : `${wedding.couple.display} monogram`}
      aria-hidden={decorative || undefined}
      priority={priority}
      sizes={`${size}px`}
      className={className}
    />
  );
}
