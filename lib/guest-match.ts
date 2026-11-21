/**
 * Guest-name verification, ported from the legacy RSVP page. Steps, in order:
 * 1. exact invitation name, 2. exact household member,
 * 3. word-prefix match ("mich bask" -> "Michael Baskhairoun"); a unique hit wins,
 * 4. Levenshtein fuzzy match on invitation names and members.
 * Ambiguous steps 3-4 return at most MAX_SUGGESTIONS candidates, best first.
 */

export type MatchableGuest = { id: string; invitationName: string; members: string[] };

export type MatchCandidate<G> = { guest: G; matchedName: string; score: number };

export type MatchResult<G> = {
  exact: G | null;
  matchedName: string | null;
  candidates: Array<MatchCandidate<G>>;
};

export const MAX_SUGGESTIONS = 5;

export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Edit distance when within ~30% of the longer string (minimum 3 edits), otherwise Infinity. Lower is better. */
export function fuzzyScore(typed: string, candidate: string): number {
  const distance = levenshtein(typed, candidate);
  const threshold = Math.max(3, Math.ceil(Math.max(typed.length, candidate.length) * 0.3));
  return distance <= threshold ? distance : Infinity;
}

/** Every typed word is a prefix of some word in the candidate. */
export function wordsMatch(typed: string, candidate: string): boolean {
  const candidateWords = candidate.split(" ").filter(Boolean);
  const typedWords = typed.split(" ").filter(Boolean);
  return typedWords.length > 0 && typedWords.every((tw) => candidateWords.some((cw) => cw.startsWith(tw)));
}

type Scorer = (typed: string, candidate: string) => number;

/** First name on the invitation (invitation name, then members) that scores finitely. */
function bestName<G extends MatchableGuest>(guest: G, typed: string, scorer: Scorer): MatchCandidate<G> | null {
  for (const name of [guest.invitationName, ...guest.members]) {
    const score = scorer(typed, normalize(name));
    if (score !== Infinity) return { guest, matchedName: name, score };
  }
  return null;
}

function collect<G extends MatchableGuest>(guests: G[], typed: string, scorer: Scorer): Array<MatchCandidate<G>> {
  return guests.flatMap((g) => bestName(g, typed, scorer) ?? []);
}

/** Best-scoring suggestions only, so a vague query never reveals the whole guest list. */
function top<G>(candidates: Array<MatchCandidate<G>>): Array<MatchCandidate<G>> {
  return [...candidates].sort((a, b) => a.score - b.score).slice(0, MAX_SUGGESTIONS);
}

export function matchGuests<G extends MatchableGuest>(allGuests: G[], typedName: string): MatchResult<G> {
  const typed = normalize(typedName);
  const none: MatchResult<G> = { exact: null, matchedName: null, candidates: [] };
  if (!typed) return none;

  const byInvitation = allGuests.find((g) => normalize(g.invitationName) === typed);
  if (byInvitation) return { exact: byInvitation, matchedName: byInvitation.invitationName, candidates: [] };

  for (const guest of allGuests) {
    const member = guest.members.find((m) => normalize(m) === typed);
    if (member) return { exact: guest, matchedName: member, candidates: [] };
  }

  const partial = collect(allGuests, typed, (t, c) => (wordsMatch(t, c) ? c.length - t.length : Infinity));
  if (partial.length === 1) return { exact: partial[0].guest, matchedName: partial[0].matchedName, candidates: [] };
  if (partial.length > 1) return { ...none, candidates: top(partial) };

  return { ...none, candidates: top(collect(allGuests, typed, fuzzyScore)) };
}
