"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import styles from "./Reveal.module.css";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Stagger in milliseconds. */
  delay?: number;
};

/** Gently fades and lifts its children into view once they enter the viewport. */
export function Reveal({ children, as: Tag = "div", className, delay = 0 }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style = delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined;

  return (
    <Tag
      ref={ref}
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      data-visible={visible ? "true" : "false"}
      style={style}
    >
      {children}
    </Tag>
  );
}
