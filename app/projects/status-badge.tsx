import { projectStatusLabel, type ProjectStatus } from "@/lib/projects/status";

/**
 * The tone each status is drawn in.
 *
 * Only two statuses get a colour, and both earn it: `active` is work that is
 * running now, and `paused` is work that has stopped for a reason somebody
 * needs to remember. Draft and closed are the quiet states, so they stay grey
 * — a page where everything is coloured says nothing by colouring anything.
 *
 * Colour is never the only signal: the badge always spells the status out, so
 * it survives being printed, being read out, and being looked at by someone
 * who cannot tell amber from green.
 */
const TONES: Record<ProjectStatus, string> = {
  draft: "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400",
  active:
    "border-emerald-600/40 text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-400",
  paused:
    "border-amber-600/40 text-amber-700 dark:border-amber-400/40 dark:text-amber-400",
  closed: "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500",
};

/**
 * A project's status, as a badge.
 *
 * The status column is plain TEXT in SQLite, so a hand-edited row can hold a
 * value outside the enum. That falls back to the neutral tone and the raw
 * string rather than rendering an unstyled blank, for the same reason the list
 * does: a surprising word tells the reader what is in the database, and an
 * empty badge tells them nothing.
 */
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const tone = TONES[status] ?? TONES.draft;

  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${tone}`}
    >
      {projectStatusLabel(status)}
    </span>
  );
}
