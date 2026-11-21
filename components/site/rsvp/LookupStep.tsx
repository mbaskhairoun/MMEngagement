"use client";

import { useState, type FormEvent } from "react";
import { wedding } from "@/content/wedding";
import { describeError, householdOf, lookupGuest, type Candidate, type Guest } from "./api";
import { Button, TextField } from "./Fields";
import styles from "./Rsvp.module.css";

type Props = {
  /** `matchedName` is the name that matched, used to prefill the respondent's name. */
  onFound: (guest: Guest, matchedName: string | null) => void;
  onClosed: () => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "candidates"; candidates: Candidate[] }
  | { kind: "none"; query: string }
  | { kind: "error"; message: string };

export function LookupStep({ onFound, onClosed }: Props) {
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const { bride, groom } = wedding.couple;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = name.trim();
    if (!query) {
      setFieldError("Please enter your name as it appears on your invitation.");
      return;
    }
    setFieldError(undefined);
    setStatus({ kind: "loading" });

    const result = await lookupGuest(query);
    if (result.status === "closed") return onClosed();
    if (result.status === "error") {
      setStatus({ kind: "error", message: describeError(result.error, result.httpStatus) });
      return;
    }
    const { exact, matchedName, candidates } = result.data;
    if (exact) return onFound(exact, matchedName);
    if (candidates.length > 0) {
      setStatus({ kind: "candidates", candidates });
      return;
    }
    setStatus({ kind: "none", query });
  }

  return (
    <div className={styles.step}>
      <form className={styles.lookup} onSubmit={handleSubmit} noValidate>
        <TextField
          id="rsvp-lookup-name"
          label="Enter your name as it appears on your invitation"
          value={name}
          onChange={(v) => {
            setName(v);
            if (fieldError) setFieldError(undefined);
          }}
          autoComplete="name"
          maxLength={100}
          error={fieldError}
          placeholder="First and last name"
        />
        <Button type="submit" loading={status.kind === "loading"} loadingLabel="Searching">
          Find my invitation
        </Button>
      </form>

      <div aria-live="polite" className={styles.lookupResult}>
        {status.kind === "candidates" ? (
          <div className={styles.candidates}>
            <p className={styles.candidatesTitle}>
              {status.candidates.length === 1
                ? "Is this you?"
                : "We found a few possible matches"}
            </p>
            <p className={styles.candidatesHint}>Choose the invitation that is yours.</p>
            <ul className={styles.candidateList}>
              {status.candidates.map(({ guest, matchedName }) => {
                const household = householdOf(guest);
                const others = household.filter((m) => m !== guest.invitationName);
                return (
                  <li key={guest.id}>
                    <button type="button" className={styles.candidate} onClick={() => onFound(guest, matchedName)}>
                      <span className={styles.candidateName}>{guest.invitationName}</span>
                      {others.length > 0 ? (
                        <span className={styles.candidateMeta}>With {others.join(", ")}</span>
                      ) : matchedName && matchedName !== guest.invitationName ? (
                        <span className={styles.candidateMeta}>Matched {matchedName}</span>
                      ) : null}
                      <span className={styles.candidateArrow} aria-hidden="true">
                        &rarr;
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {status.kind === "none" ? (
          <p className={styles.notice}>
            We couldn&rsquo;t find an invitation for &ldquo;{status.query}&rdquo;. Please check the
            spelling exactly as it appears on your invitation, or try the name of the person it was
            addressed to. Still stuck? Reach out to {bride} or {groom} and we&rsquo;ll sort it out.
          </p>
        ) : null}

        {status.kind === "error" ? (
          <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
