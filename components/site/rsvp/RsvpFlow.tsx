"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_FIELDS,
  describeError,
  getExistingRsvp,
  getSettings,
  householdOf,
  type FieldFlags,
  type Guest,
  type RsvpPayload,
  type SubmitSuccess,
} from "./api";
import { Button } from "./Fields";
import { LookupStep } from "./LookupStep";
import { initialFormState, RsvpForm, type FormState } from "./RsvpForm";
import { ClosedState, SuccessState } from "./States";
import styles from "./Rsvp.module.css";

type Phase =
  | { step: "lookup" }
  | { step: "loading"; guest: Guest }
  | { step: "form"; guest: Guest; form: FormState; isUpdate: boolean }
  | { step: "done"; guest: Guest; form: FormState; result: SubmitSuccess; payload: RsvpPayload }
  | { step: "closed" };

export function RsvpFlow() {
  const [phase, setPhase] = useState<Phase>({ step: "lookup" });
  const [fields, setFields] = useState<FieldFlags>(DEFAULT_FIELDS);
  const [loadError, setLoadError] = useState<string | null>(null);
  const focusNext = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Settings decide which fields show and whether replies are open at all.
  useEffect(() => {
    let cancelled = false;
    getSettings().then((result) => {
      if (cancelled) return;
      if (result.status === "closed") setPhase({ step: "closed" });
      else if (result.status === "ok") {
        setFields(result.data.fields);
        if (result.data.rsvpDisabled) setPhase({ step: "closed" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Moves focus to the new step's heading after a transition. */
  const headingRef = useCallback((node: HTMLHeadingElement | null) => {
    if (node && focusNext.current) {
      focusNext.current = false;
      node.focus({ preventScroll: true });
      rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, []);

  const go = (next: Phase) => {
    focusNext.current = true;
    setPhase(next);
  };

  async function selectGuest(guest: Guest, matchedName: string | null) {
    setLoadError(null);
    go({ step: "loading", guest });
    const result = await getExistingRsvp(guest.id);
    if (result.status === "closed") return go({ step: "closed" });
    if (result.status === "error") {
      setLoadError(describeError(result.error, result.httpStatus));
      go({ step: "lookup" });
      return;
    }
    const existing = result.data;
    go({
      step: "form",
      guest,
      form: initialFormState(guest, existing, matchedName),
      isUpdate: Boolean(existing) || guest.hasRsvped,
    });
  }

  const reset = () => {
    setLoadError(null);
    go({ step: "lookup" });
  };

  return (
    <div ref={rootRef} className={styles.flow}>
      {phase.step === "lookup" ? (
        <>
          <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            Find your invitation
          </h3>
          {loadError ? (
            <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
              {loadError}
            </p>
          ) : null}
          <LookupStep onFound={selectGuest} onClosed={() => go({ step: "closed" })} />
        </>
      ) : null}

      {phase.step === "loading" ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinnerLarge} aria-hidden="true" />
          <p>Finding your invitation&hellip;</p>
        </div>
      ) : null}

      {phase.step === "form" ? (
        <>
          <div className={styles.welcome}>
            <p className="eyebrow">Your invitation</p>
            <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
              Welcome, {phase.guest.invitationName}
            </h3>
            {householdOf(phase.guest).length > 1 ? (
              <p className={styles.household}>Invitation for {householdOf(phase.guest).join(", ")}</p>
            ) : null}
            {phase.isUpdate ? (
              <p className={styles.already}>
                You&rsquo;ve already replied. Feel free to update your response below.
              </p>
            ) : null}
            <Button variant="quiet" onClick={reset}>
              Not you?
            </Button>
          </div>
          <RsvpForm
            guest={phase.guest}
            fields={fields}
            state={phase.form}
            isUpdate={phase.isUpdate}
            onStateChange={(form) => setPhase({ ...phase, form })}
            onSubmitted={(result, payload) =>
              go({ step: "done", guest: phase.guest, form: phase.form, result, payload })
            }
            onClosed={() => go({ step: "closed" })}
          />
        </>
      ) : null}

      {phase.step === "done" ? (
        <SuccessState
          result={phase.result}
          payload={phase.payload}
          headingRef={headingRef}
          onEdit={() => go({ step: "form", guest: phase.guest, form: phase.form, isUpdate: true })}
        />
      ) : null}

      {phase.step === "closed" ? <ClosedState headingRef={headingRef} /> : null}
    </div>
  );
}
