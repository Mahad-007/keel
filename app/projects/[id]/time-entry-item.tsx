import type { ReactNode } from "react";

import { formatMinutes } from "@/lib/minutes";
import {
  attributionLabel,
  entryMarks,
  NO_NOTE_LABEL,
  type EntryAttribution,
  type ListedTimeEntry,
} from "@/lib/time/entry";

import { TimeRow } from "./time-row";

/**
 * One logged stretch of work: how long it took, what was done, and where it
 * went.
 *
 * The duration leads, in a column of its own, because a time list is a ledger
 * and the figures have to form a readable column — a duration that starts
 * wherever the note before it ended is a figure nobody can add up by eye. It
 * sits in the same left gutter the scope list puts its position numbers in, so
 * the two lists on this project share an edge.
 *
 * The note is the row's own line and the attribution is underneath it, which
 * is the order of what a reader is looking for: what was done first, which
 * line of scope it counted against second. Both in words — "The project
 * itself" rather than a blank, "Not chargeable" rather than a coloured dot.
 *
 * The controls are passed in rather than built here. A row cannot know whether
 * it is the one the list has open, and a billed row has no controls at all.
 */
export function TimeEntryItem({
  entry,
  where,
  controls,
  prompt,
}: {
  entry: ListedTimeEntry;
  /** Where the work went, resolved against the scope list the page read. */
  where: EntryAttribution;
  /**
   * What can be done to this entry — omitted where a time list is being read
   * rather than worked on, and on a row an invoice has billed.
   */
  controls?: ReactNode;
  /**
   * A question about this entry, asked underneath it — today, whether to
   * delete it. Below rather than beside, so the row it is about stays readable
   * while it is being asked, and full width because it is a sentence rather
   * than a figure.
   */
  prompt?: ReactNode;
}) {
  const marks = entryMarks(entry);

  return (
    <TimeRow>
      <p className="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
        {formatMinutes(entry.minutes)}
      </p>
      <div className="min-w-0 flex-1">
        {/*
          A note is allowed 500 characters and nothing makes them be words: a
          pasted URL or a run of hyphens would otherwise push the controls off
          the right of the list. Line breaks are kept, because a note is
          sometimes the two or three things an afternoon went on.

          No note says so, in the colour the page uses for what is missing. The
          gap matters: a note is what an invoice line is written from, and an
          entry without one is time nobody will be able to account for.
        */}
        {entry.note === null ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            {NO_NOTE_LABEL}
          </p>
        ) : (
          <p className="max-w-prose whitespace-pre-line break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">
            {entry.note}
          </p>
        )}
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {attributionLabel(where)}
          {marks.map((mark) => (
            /*
              Set a shade darker than the attribution beside it. A mark is the
              one thing on the row that changes what the time is worth, and the
              colour is the second way of telling — the word is the first.
            */
            <span
              key={mark}
              className="text-zinc-700 dark:text-zinc-300"
            >
              {" · "}
              {mark}
            </span>
          ))}
        </p>
      </div>
      {/*
        Last in the row and last in the tab order, after the entry they act on:
        a reader reaches the controls having already read what they would be
        changing. On a narrow screen the row wraps and they drop underneath,
        which is why the note block keeps the whole width it can get.
      */}
      {controls}
      {prompt}
    </TimeRow>
  );
}
