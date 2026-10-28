import {
  CONFIRM_DISCARD_TIMER_ID,
  CONFIRM_DISCARD_TIMER_LABEL,
  describeTimerDiscard,
  KEEP_TIMER_LABEL,
  TIMER_DISCARD_PROMPT_ID,
} from "@/lib/time/stop";

/**
 * The step in front of throwing a running clock away.
 *
 * It sits in the panel, under the figure it is about to discard, so the reader
 * can read both at once — the thing `window.confirm` cannot do. A browser
 * dialogue is a modal interruption carrying one unstyled string, suppressible
 * by a browser that has decided this page shows too many of them, and it hides
 * the figure it is asking about behind itself. This one names the figure,
 * which is the whole point: the reader may not have looked at the clock since
 * they started it.
 *
 * Two buttons, neither of them a default: the one that discards is marked as
 * the destructive one, and keeping is the way out. "Keep the clock running"
 * rather than "Cancel", which is a word about the dialogue instead of about
 * the clock.
 *
 * The cursor lands on the way out, for the reason the deletion step's does:
 * the step is opened by pressing a button, a button is pressed with Enter or
 * Space, and a held key or the habit of confirming everything with Enter would
 * land on whatever has the focus. If that were the discarding button, the step
 * would be a formality that fires itself.
 */
export function DiscardTimerPrompt({
  minutes,
  onDiscard,
  onKeep,
  pending,
}: {
  /** How long the clock has run, which is what is about to be lost. */
  minutes: number;
  /** The reader means it. The panel sends the write. */
  onDiscard: () => void;
  /** The reader is keeping the clock. Nothing was written. */
  onKeep: () => void;
  /** Whether a press is already in flight, so neither fires twice. */
  pending: boolean;
}) {
  return (
    /*
      Named by its own question, so a reader arriving from the Discard button
      is told what they are being asked rather than finding two unlabelled
      buttons. `aria-labelledby` rather than a repeated `aria-label`: the
      sentence is already on screen, and two copies drift.
    */
    <div
      role="group"
      aria-labelledby={TIMER_DISCARD_PROMPT_ID}
      className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <p
        id={TIMER_DISCARD_PROMPT_ID}
        className="max-w-prose text-sm leading-6 text-amber-900 dark:text-amber-100"
      >
        {describeTimerDiscard(minutes)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          id={CONFIRM_DISCARD_TIMER_ID}
          onClick={onDiscard}
          disabled={pending}
          aria-label={CONFIRM_DISCARD_TIMER_LABEL}
          aria-describedby={TIMER_DISCARD_PROMPT_ID}
          className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-800 dark:hover:bg-red-700"
        >
          Discard
        </button>
        <button
          type="button"
          autoFocus
          onClick={onKeep}
          disabled={pending}
          aria-label={KEEP_TIMER_LABEL}
          aria-describedby={TIMER_DISCARD_PROMPT_ID}
          className="text-sm text-amber-900 underline underline-offset-4 hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-100 dark:hover:text-white"
        >
          Keep it running
        </button>
      </div>
    </div>
  );
}
