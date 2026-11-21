import { wedding } from "@/content/wedding";
import { googleCalendarUrl } from "../time";
import type { RsvpPayload, SubmitSuccess } from "./api";
import { Button } from "./Fields";
import styles from "./Rsvp.module.css";

function Flourish() {
  return (
    <svg className={styles.flourish} viewBox="0 0 120 24" width="120" height="24" aria-hidden="true">
      <path
        d="M2 12c9 0 9-7 18-7s9 7 18 7 9-7 18-7M66 12c9 0 9-7 18-7s9 7 18 7 9-7 16-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="60" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}

type SuccessProps = {
  result: SubmitSuccess;
  payload: RsvpPayload;
  onEdit: () => void;
  headingRef: (node: HTMLHeadingElement | null) => void;
};

export function SuccessState({ result, payload, onEdit, headingRef }: SuccessProps) {
  const { date, events, couple } = wedding;
  const firstName = payload.fullName.split(/\s+/)[0] || payload.fullName;
  const accepted = payload.attending;
  const goingTo = events.filter((e) => (payload.events as string[]).includes(e.id));

  const title = result.isUpdate
    ? "Your reply has been updated"
    : accepted
      ? "We can’t wait to celebrate with you"
      : "You’ll be dearly missed";

  let body: string;
  if (accepted) {
    const where = goingTo.map((e) => e.venue).join(" and ");
    body = result.isUpdate
      ? `Thank you, ${firstName}. We have your latest details and still can’t wait to see you at ${where} on ${date.display}.`
      : `Thank you, ${firstName}. Your reply is safely with us, and we’ll be looking for you at ${where} on ${date.display}.`;
  } else {
    body = result.isUpdate
      ? `Thank you for letting us know, ${firstName}. We’ve updated your reply, and we’ll be thinking of you on ${date.display}.`
      : `Thank you for letting us know, ${firstName}. We’ll be thinking of you on ${date.display}, and we hope to celebrate together soon.`;
  }

  return (
    <div className={styles.success}>
      <Flourish />
      <h3 ref={headingRef} tabIndex={-1} className={styles.successTitle}>
        {title}
      </h3>
      <p className={styles.successBody}>{body}</p>
      {result.emailSent ? (
        <p className={styles.successNote}>
          A confirmation is on its way to <strong>{payload.email}</strong>.
        </p>
      ) : null}
      {accepted ? (
        <div className={styles.successLinks}>
          <a className={styles.linkButton} href="/api/calendar.ics" download>
            Add to Apple or Outlook
          </a>
          <a className={styles.linkButton} href={googleCalendarUrl()} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </div>
      ) : null}
      <p className={styles.signoff}>With love, {couple.bride} &amp; {couple.groom}</p>
      <Button variant="quiet" onClick={onEdit}>
        Change my response
      </Button>
    </div>
  );
}

export function ClosedState({ headingRef }: { headingRef: (node: HTMLHeadingElement | null) => void }) {
  const { bride, groom } = wedding.couple;
  return (
    <div className={styles.success}>
      <Flourish />
      <h3 ref={headingRef} tabIndex={-1} className={styles.successTitle}>
        RSVPs are now closed
      </h3>
      <p className={styles.successBody}>
        Thank you to everyone who replied. If you have a question about your invitation, please
        reach out to {bride} or {groom} directly. We&rsquo;d love to hear from you.
      </p>
    </div>
  );
}
