"use client";

import { useState, type FormEvent } from "react";
import { wedding } from "@/content/wedding";
import {
  describeError,
  householdOf,
  submitRsvp,
  type EventId,
  type FieldFlags,
  type Guest,
  type Rsvp,
  type RsvpPayload,
  type SubmitSuccess,
} from "./api";
import { RECEPTION_TOWN } from "../constants";
import { Button, Checkbox, SelectField, TextArea, TextField } from "./Fields";
import styles from "./Rsvp.module.css";

export const RELATIONSHIPS = [
  `Family of ${wedding.couple.bride}`,
  `Family of ${wedding.couple.groom}`,
  `Friend of ${wedding.couple.bride}`,
  `Friend of ${wedding.couple.groom}`,
  "Friend of both",
  "Colleague",
  "Other",
] as const;

export const MEALS = ["Standard", "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free"] as const;

const CHILDREN = ["0", "1", "2", "3", "4+"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormState = {
  fullName: string;
  email: string;
  phone: string;
  attending: "" | "yes" | "no";
  members: Record<string, boolean>;
  events: Record<EventId, boolean>;
  relationship: string;
  mealPreference: string;
  dietaryRestrictions: string;
  childrenCount: (typeof CHILDREN)[number];
  childrenAges: string;
  songRequest: string;
  transportNeeded: boolean;
  accommodationNeeded: boolean;
  specialRequests: string;
  message: string;
};

type Errors = Partial<Record<"fullName" | "email" | "attending" | "members" | "events", string>>;

export function initialFormState(guest: Guest, existing: Rsvp | null, matchedName: string | null): FormState {
  const household = householdOf(guest);
  const attendingSet = new Set(
    existing?.attending ? existing.attendingMembers.map((m) => m.toLowerCase()) : household.map((m) => m.toLowerCase()),
  );
  const existingEvents = existing?.attending && existing.events.length ? new Set(existing.events) : null;
  const children = existing ? Math.min(existing.childrenCount, 4) : 0;
  return {
    fullName: existing?.fullName ?? matchedName ?? household[0] ?? guest.invitationName,
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
    attending: existing ? (existing.attending ? "yes" : "no") : "",
    members: Object.fromEntries(household.map((m) => [m, attendingSet.has(m.toLowerCase())])),
    events: {
      ceremony: existingEvents ? existingEvents.has("ceremony") : true,
      reception: existingEvents ? existingEvents.has("reception") : true,
    },
    relationship: existing?.relationship ?? "",
    mealPreference: existing?.mealPreference ?? "",
    dietaryRestrictions: existing?.dietaryRestrictions ?? "",
    childrenCount: children >= 4 ? "4+" : (String(children) as FormState["childrenCount"]),
    childrenAges: existing?.childrenAges ?? "",
    songRequest: existing?.songRequest ?? "",
    transportNeeded: existing?.transportNeeded ?? false,
    accommodationNeeded: existing?.accommodationNeeded ?? false,
    specialRequests: existing?.specialRequests ?? "",
    message: existing?.message ?? "",
  };
}

function validate(state: FormState, household: string[]): Errors {
  const errors: Errors = {};
  if (!state.fullName.trim()) errors.fullName = "Please tell us your name.";
  if (!state.email.trim()) errors.email = "We'll send your confirmation here, so please add your email.";
  else if (!EMAIL_RE.test(state.email.trim())) errors.email = "That email doesn't look quite right.";
  if (!state.attending) errors.attending = "Please let us know whether you can join us.";
  if (state.attending === "yes") {
    if (household.length > 1 && !household.some((m) => state.members[m])) {
      errors.members = "Please tick at least one name who will be joining us.";
    }
    if (!state.events.ceremony && !state.events.reception) {
      errors.events = "Please choose at least one part of the day.";
    }
  }
  return errors;
}

function toPayload(guest: Guest, state: FormState, fields: FieldFlags): RsvpPayload {
  const household = householdOf(guest);
  const attending = state.attending === "yes";
  const attendingMembers = attending
    ? household.length > 1
      ? household.filter((m) => state.members[m])
      : household
    : [];
  const declinedMembers = household.filter((m) => !attendingMembers.includes(m));
  const show = (key: keyof FieldFlags) => attending && fields[key];
  const children = state.childrenCount === "4+" ? 4 : Number(state.childrenCount);

  return {
    guestId: guest.id,
    fullName: state.fullName.trim(),
    email: state.email.trim(),
    phone: fields.phone ? state.phone.trim() : "",
    attending,
    attendingMembers,
    declinedMembers,
    memberEmails: {},
    events: attending ? (["ceremony", "reception"] as const).filter((id) => state.events[id]) : [],
    relationship: show("relationship") ? state.relationship : "",
    mealPreference: show("mealPreference") ? state.mealPreference : "",
    dietaryRestrictions: show("dietary") ? state.dietaryRestrictions.trim() : "",
    childrenCount: show("childrenCount") ? children : 0,
    childrenAges: show("childrenCount") && children > 0 ? state.childrenAges.trim() : "",
    songRequest: show("songRequest") ? state.songRequest.trim() : "",
    transportNeeded: show("transportNeeded") ? state.transportNeeded : false,
    accommodationNeeded: show("accommodationNeeded") ? state.accommodationNeeded : false,
    specialRequests: show("specialRequests") ? state.specialRequests.trim() : "",
    message: fields.message ? state.message.trim() : "",
  };
}

type Props = {
  guest: Guest;
  fields: FieldFlags;
  state: FormState;
  onStateChange: (next: FormState) => void;
  onSubmitted: (result: SubmitSuccess, payload: RsvpPayload) => void;
  onClosed: () => void;
  /** True when this household has replied before. */
  isUpdate: boolean;
};

export function RsvpForm({ guest, fields, state, onStateChange, onSubmitted, onClosed, isUpdate }: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const household = householdOf(guest);
  const attending = state.attending === "yes";
  const [ceremony, reception] = wedding.events;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    onStateChange({ ...state, [key]: value });
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const found = validate(state, household);
    setErrors(found);
    const firstKey = (["fullName", "email", "attending", "members", "events"] as const).find((k) => found[k]);
    if (firstKey) {
      const target = document.getElementById(`rsvp-${firstKey}`);
      target?.focus();
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    const payload = toPayload(guest, state, fields);
    const result = await submitRsvp(payload);
    setSubmitting(false);
    if (result.status === "closed") return onClosed();
    if (result.status === "error") {
      setServerError(describeError(result.error, result.httpStatus));
      return;
    }
    onSubmitted(result.data, payload);
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-describedby="rsvp-form-status">
      <p id="rsvp-form-status" className="visually-hidden" aria-live="polite">
        {errorCount > 0 ? `There ${errorCount === 1 ? "is 1 detail" : `are ${errorCount} details`} to check below.` : ""}
      </p>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Your details</legend>
        <TextField
          id="rsvp-fullName"
          label="Your full name"
          value={state.fullName}
          onChange={(v) => set("fullName", v)}
          autoComplete="name"
          maxLength={100}
          required
          error={errors.fullName}
        />
        <div className={fields.phone ? styles.row : undefined}>
          <TextField
            id="rsvp-email"
            label="Email"
            type="email"
            inputMode="email"
            value={state.email}
            onChange={(v) => set("email", v)}
            autoComplete="email"
            maxLength={254}
            required
            error={errors.email}
          />
          {fields.phone ? (
            <TextField
              id="rsvp-phone"
              label="Phone"
              type="tel"
              inputMode="tel"
              value={state.phone}
              onChange={(v) => set("phone", v)}
              autoComplete="tel"
              maxLength={40}
              optional
            />
          ) : null}
        </div>
      </fieldset>

      <fieldset
        className={styles.group}
        aria-describedby={errors.attending ? "rsvp-attending-error" : undefined}
      >
        <legend className={styles.legend}>Will you join us?</legend>
        <div className={styles.choiceRow} id="rsvp-attending" tabIndex={-1}>
          {(
            [
              { value: "yes", title: "Joyfully accept", sub: "We wouldn't miss it" },
              { value: "no", title: "Regretfully decline", sub: "We'll be there in spirit" },
            ] as const
          ).map((opt) => (
            <label key={opt.value} className={styles.choice} data-checked={state.attending === opt.value}>
              <input
                type="radio"
                name="attending"
                value={opt.value}
                className={styles.choiceInput}
                checked={state.attending === opt.value}
                onChange={() => set("attending", opt.value)}
              />
              <span className={styles.choiceTitle}>{opt.title}</span>
              <span className={styles.choiceSub}>{opt.sub}</span>
            </label>
          ))}
        </div>
        {errors.attending ? (
          <p id="rsvp-attending-error" className={styles.error}>
            {errors.attending}
          </p>
        ) : null}
      </fieldset>

      {attending ? (
        <div className={styles.reveal}>
          {household.length > 1 ? (
            <fieldset
              className={styles.group}
              aria-describedby={errors.members ? "rsvp-members-error" : undefined}
            >
              <legend className={styles.legend}>Who&rsquo;s coming?</legend>
              <p className={styles.hint}>Untick anyone from your invitation who can&rsquo;t make it.</p>
              <div className={styles.checkList} id="rsvp-members" tabIndex={-1}>
                {household.map((member, i) => (
                  <Checkbox
                    key={member}
                    id={`rsvp-member-${i}`}
                    label={member}
                    checked={Boolean(state.members[member])}
                    onChange={(checked) => set("members", { ...state.members, [member]: checked })}
                  />
                ))}
              </div>
              {errors.members ? (
                <p id="rsvp-members-error" className={styles.error}>
                  {errors.members}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          <fieldset
            className={styles.group}
            aria-describedby={errors.events ? "rsvp-events-error" : undefined}
          >
            <legend className={styles.legend}>Which parts of the day?</legend>
            <div className={styles.checkList} id="rsvp-events" tabIndex={-1}>
              <Checkbox
                id="rsvp-event-ceremony"
                label={`${ceremony.kind} · ${ceremony.startDisplay}`}
                description={`${ceremony.venue}, ${ceremony.area}`}
                checked={state.events.ceremony}
                onChange={(checked) => set("events", { ...state.events, ceremony: checked })}
              />
              <Checkbox
                id="rsvp-event-reception"
                label={`${reception.kind} · ${reception.startDisplay}`}
                description={`${reception.venue}, ${reception.area}`}
                checked={state.events.reception}
                onChange={(checked) => set("events", { ...state.events, reception: checked })}
              />
            </div>
            {errors.events ? (
              <p id="rsvp-events-error" className={styles.error}>
                {errors.events}
              </p>
            ) : null}
          </fieldset>

          {fields.relationship || fields.mealPreference || fields.dietary || fields.childrenCount ? (
            <fieldset className={styles.group}>
              <legend className={styles.legend}>A little more about you</legend>
              {fields.relationship || fields.mealPreference ? (
                <div className={styles.row}>
                  {fields.relationship ? (
                    <SelectField
                      id="rsvp-relationship"
                      label="How do you know us?"
                      value={state.relationship}
                      onChange={(v) => set("relationship", v)}
                      options={RELATIONSHIPS}
                      optional
                    />
                  ) : null}
                  {fields.mealPreference ? (
                    <SelectField
                      id="rsvp-meal"
                      label="Meal preference"
                      value={state.mealPreference}
                      onChange={(v) => set("mealPreference", v)}
                      options={MEALS}
                      optional
                    />
                  ) : null}
                </div>
              ) : null}
              {fields.dietary ? (
                <TextArea
                  id="rsvp-dietary"
                  label="Dietary restrictions or allergies"
                  value={state.dietaryRestrictions}
                  onChange={(v) => set("dietaryRestrictions", v)}
                  rows={2}
                  optional
                />
              ) : null}
              {fields.childrenCount ? (
                <div className={styles.row}>
                  <SelectField
                    id="rsvp-children"
                    label="Children attending"
                    value={state.childrenCount}
                    onChange={(v) => set("childrenCount", v as FormState["childrenCount"])}
                    options={CHILDREN}
                    placeholder=""
                  />
                  {state.childrenCount !== "0" ? (
                    <TextField
                      id="rsvp-children-ages"
                      label="Their ages"
                      value={state.childrenAges}
                      onChange={(v) => set("childrenAges", v)}
                      placeholder="e.g. 4 and 7"
                      maxLength={200}
                      optional
                    />
                  ) : null}
                </div>
              ) : null}
            </fieldset>
          ) : null}

          {fields.songRequest || fields.transportNeeded || fields.accommodationNeeded || fields.specialRequests ? (
            <fieldset className={styles.group}>
              <legend className={styles.legend}>For the evening</legend>
              {fields.songRequest ? (
                <TextField
                  id="rsvp-song"
                  label="A song that will get you dancing"
                  value={state.songRequest}
                  onChange={(v) => set("songRequest", v)}
                  maxLength={200}
                  optional
                />
              ) : null}
              {fields.transportNeeded || fields.accommodationNeeded ? (
                <div className={styles.checkList}>
                  {fields.transportNeeded ? (
                    <Checkbox
                      id="rsvp-transport"
                      label={`I'd like help with transport to ${RECEPTION_TOWN}`}
                      checked={state.transportNeeded}
                      onChange={(c) => set("transportNeeded", c)}
                    />
                  ) : null}
                  {fields.accommodationNeeded ? (
                    <Checkbox
                      id="rsvp-accommodation"
                      label="I'd like help arranging accommodation"
                      checked={state.accommodationNeeded}
                      onChange={(c) => set("accommodationNeeded", c)}
                    />
                  ) : null}
                </div>
              ) : null}
              {fields.specialRequests ? (
                <TextArea
                  id="rsvp-special"
                  label="Anything else we should know?"
                  hint="Accessibility needs, a high chair, a quiet seat away from the speakers."
                  value={state.specialRequests}
                  onChange={(v) => set("specialRequests", v)}
                  rows={2}
                  optional
                />
              ) : null}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {fields.message ? (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>A note for the couple</legend>
          <TextArea
            id="rsvp-message"
            label={`A message for ${wedding.couple.bride} & ${wedding.couple.groom}`}
            value={state.message}
            onChange={(v) => set("message", v)}
            rows={4}
            optional
          />
        </fieldset>
      ) : null}

      {serverError ? (
        <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {serverError}
        </p>
      ) : null}

      <div className={styles.submitRow}>
        <Button type="submit" loading={submitting} loadingLabel="Sending">
          {isUpdate ? "Update my RSVP" : "Send my RSVP"}
        </Button>
        <p className={styles.deadlineNote}>Kindly reply by {wedding.rsvp.deadlineDisplay}</p>
      </div>
    </form>
  );
}
