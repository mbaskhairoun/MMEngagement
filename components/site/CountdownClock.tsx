"use client";

import { useEffect, useState } from "react";
import styles from "./Countdown.module.css";

type Props = {
  /** Ceremony start, epoch ms. */
  target: number;
  /** End of the celebrations, epoch ms. */
  end: number;
};

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function split(ms: number): Parts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

const UNITS: { key: keyof Parts; label: string; single: string }[] = [
  { key: "days", label: "Days", single: "Day" },
  { key: "hours", label: "Hours", single: "Hour" },
  { key: "minutes", label: "Minutes", single: "Minute" },
  { key: "seconds", label: "Seconds", single: "Second" },
];

export function CountdownClock({ target, end }: Props) {
  // null until mounted so server and client markup match.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now !== null && now >= target) {
    return (
      <p className={styles.after}>
        {now < end ? "Today is the day. We are so glad you are here." : "We are married. Thank you for celebrating with us."}
      </p>
    );
  }

  const parts = now === null ? null : split(target - now);
  const summary = parts
    ? `${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes to go`
    : "Countdown to the ceremony";

  return (
    <div className={styles.clock} role="timer" aria-label={summary}>
      {UNITS.map(({ key, label, single }) => {
        const value = parts ? parts[key] : null;
        const text = value === null ? "––" : String(value).padStart(2, "0");
        return (
          <div key={key} className={styles.unit} aria-hidden="true">
            <span className={styles.digits}>
              <span key={text} className={value === null ? styles.placeholder : styles.digit}>
                {text}
              </span>
            </span>
            <span className={styles.label}>{value === 1 ? single : label}</span>
          </div>
        );
      })}
    </div>
  );
}
