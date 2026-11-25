import type { BurnSummary } from "@/lib/burn";
import { assessProjectCreep } from "@/lib/projects/creep-readings";
import {
  hasScopeHealthToShow,
  scopeHealthBanner,
} from "@/lib/projects/scope-health";
import type { ScopeLine } from "@/lib/scope";
import {
  DEFAULT_CREEP_THRESHOLDS,
  type ScopeHealth,
} from "@/lib/scope-creep";


/**
 * A project reading fine, which is most of them: a hairline border and no fill
 * at all.
 *
 * The quietest thing the banner can be, because an engagement going to plan
 * should not be the loudest box on its own page. It is still a box — the
 * verdict was reached and the figures behind it are worth a reader's eye — but
 * nothing about it competes with the one next door that is flagged.
 *
 * No text colour either, so the words are the page's own. The other two tones
 * have to set one to stay legible on a fill; this one has nothing to be legible
 * against.
 */
const ON_TRACK_TONE = "border-zinc-200 dark:border-zinc-800";

/**
 * Amber: do not take the figures at face value.
 *
 * Worn by two different headings, and they are the same instruction. "Worth
 * watching" says the money is moving faster than the work and somebody should
 * look; "Not assessed" says the money could not be read and nobody can say
 * whether it is moving at all. Both mean a reader should stop, and neither
 * means anything has failed yet.
 *
 * The same amber, and deliberately the same values, as `CaveatNote` — which is
 * the component that taught this app what the colour means, and which a reader
 * meets further down this very tab under the burn figures.
 */
const LOOK_AT_THIS_TONE =
  "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100";

/**
 * Red: the money agreed has gone, or gone somewhere the work has not followed.
 *
 * The only red on the project page that is not a refused write, and the
 * distinction is deliberate: `AlertNote`'s red means a press did not stick, and
 * this one means a fact about the engagement that no amount of reloading will
 * change. Both are the colour somebody stops at, which is the whole purpose
 * here — this is the verdict the phase exists to surface.
 */
const OVER_SCOPE_TONE =
  "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100";

/**
 * How loud each verdict is allowed to be.
 *
 * A record over every verdict rather than a chain of conditions, so a fourth
 * one is a compile error here rather than a banner with no border.
 *
 * The colour is the only thing on this banner that the component decides, and
 * it decides it from the verdict alone — never from a share, a gap or a count.
 * A box that picked its own threshold would be a second classifier, and the one
 * a reader believed.
 */
const SCOPE_HEALTH_TONE: Record<ScopeHealth, string> = {
  healthy: ON_TRACK_TONE,
  watch: LOOK_AT_THIS_TONE,
  over: OVER_SCOPE_TONE,
};

/**
 * The tone for a verdict, or for the absence of one.
 *
 * A withheld verdict is amber rather than neutral, which is the one decision
 * here worth arguing about. Neutral would read as "nothing to see", and the
 * project it would read that way about is the one with hours logged and no rate
 * to value them — the single most expensive thing this page could be quiet
 * about.
 */
function scopeHealthTone(health: ScopeHealth | null): string {
  if (health === null) return LOOK_AT_THIS_TONE;
  return SCOPE_HEALTH_TONE[health];
}

/** Ties the banner's region to the heading that names it. */
const HEADING_ID = "scope-health-heading";

/**
 * Why this project is flagged, in a sentence, at the top of its overview.
 *
 * The one thing on the page that reaches a conclusion. Everything else on the
 * project — the burn figures, the scope summary, the rollup — is a measurement,
 * and a reader has to hold two percentages in their head and decide what the
 * pair of them means. This decides, and then says what it decided on.
 *
 * Not a coloured dot, and not a bar. A dot says the project is amber and leaves
 * the reader to guess which of the two axes went wrong, by how much, and
 * whether anything was measurable at all — so the figure that matters never
 * reaches them and the one thing they can do about it is hover and hope. A
 * sentence costs four lines of the page and says all three.
 *
 * Nothing is computed here. The verdict is `lib/scope-creep.ts`, the readings
 * are `lib/projects/creep-readings.ts`, the words are
 * `lib/projects/scope-health.ts`, and this maps the four fields of a
 * `ScopeHealthBanner` onto four pieces of markup. The one decision left to the
 * component is the border colour, and it is taken from the verdict rather than
 * from any of the figures.
 */
export function ScopeHealthBanner({
  summary,
  lines,
}: {
  /** The burn, which carries the money axis whole. */
  summary: BurnSummary;
  /** The scope list, which carries the delivery axis and its caveats. */
  lines: readonly ScopeLine[];
}) {
  // A fact about the project rather than about this tab, so it is named and
  // tested in `lib/projects/scope-health.ts` and merely consulted here.
  if (!hasScopeHealthToShow(summary, lines.length)) return null;

  const banner = scopeHealthBanner(
    assessProjectCreep(summary, lines, DEFAULT_CREEP_THRESHOLDS),
  );

  return (
    <section
      aria-labelledby={HEADING_ID}
      className={`mt-4 max-w-prose rounded border px-4 py-3 ${scopeHealthTone(
        banner.health,
      )}`}
    >
      {/*
        Named by its heading, so the box is a region a reader can jump to and
        the verdict is what it is called. Without the name it is a bare `section`
        — which carries no role at all, so the one conclusion on the page would
        be reachable only by reading the whole tab in order. The colour that
        makes it findable on screen is no help here, which is most of the reason
        the colour is not what carries the meaning.
      */}
      <h3 id={HEADING_ID} className="text-sm font-medium">
        {banner.headline}
      </h3>
      {/*
        The milestone, in one element. It is the first thing under the heading
        because a reader who stopped at the heading has been told a verdict and
        nothing else, and the next line is the only place they find out what it
        was reached from.
      */}
      <p className="mt-1 text-sm leading-6">{banner.verdict}</p>
      {/*
        The comparisons that also came out badly, under the worst one. Bulleted
        rather than run together into the paragraph above, because they are
        separate things to do something about: a project past its contract value
        and a long way ahead of its delivery has a conversation to have about
        the money and a different one to have about the scope.

        Usually empty — one comparison flags most projects — so the list and its
        spacing drop out rather than leaving a gap under the sentence.
      */}
      {banner.reasons.length === 0 ? null : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
          {banner.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {/*
        What the verdict could not see, below a hairline rule and in smaller
        type. Last because it is the least urgent thing in the box and the most
        likely to be skipped — a reader who trusts the verdict has already
        finished reading — and divided off because it is about the verdict
        rather than about the project.

        Inside the box rather than under it, because a caveat that escaped the
        border would read as a caveat about the whole tab. It is this verdict
        that is partly blind, and the burn figures further down say for
        themselves which of their own rows is missing a field.

        Borrowing the box's own text colour at reduced weight rather than
        zinc-500, which would be unreadable on amber and wrong on red.
      */}
      {banner.gaps.length === 0 ? null : (
        <ul className="mt-3 space-y-1.5 border-t border-current/15 pt-2.5 text-xs leading-5 opacity-80">
          {banner.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
