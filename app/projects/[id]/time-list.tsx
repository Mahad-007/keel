import type { TimeEntry } from "@/lib/db/schema";
import type { AttributableDeliverable } from "@/lib/time/attribution";
import type { EditTimeState } from "@/lib/time/edit";

import { TimeRows } from "./time-rows";
import { writeTimeEntryDelete, writeTimeEntryEdit } from "./time-writes";

/**
 * A project's logged time, with the two writes bound to the project the page
 * was served for.
 *
 * What this component does is narrow the rows and close over the project. The
 * list itself is a client component, because a deletion has to show before the
 * server has agreed to it — see `TimeRows`.
 */
export function TimeList({
  projectId,
  entries,
  deliverables,
}: {
  projectId: string;
  /** This project's entries, newest work first, as the data layer orders them. */
  entries: readonly TimeEntry[];
  /**
   * This project's scope list, in agreed order: the attribution picker inside
   * an editor is built from it, and every row's attribution is named from it.
   * Read by the page rather than here, so every query the project page makes
   * stays in one place — and so the list the picker offers is the same list
   * the write checks a submission against.
   */
  deliverables: readonly AttributableDeliverable[];
}) {
  /*
    Both lists are narrowed to the columns the rows and the writes actually
    read, and that is not tidiness: a variable captured by a `"use server"`
    closure is serialised into the page, so capturing whole rows would put
    every description, timestamp and project id on this project into the
    markup — and send them to the client on every render.
  */
  const offered = deliverables.map((deliverable) => ({
    id: deliverable.id,
    title: deliverable.title,
    estimatedMinutes: deliverable.estimatedMinutes,
  }));

  const listed = entries.map((entry) => ({
    id: entry.id,
    minutes: entry.minutes,
    note: entry.note,
    workedOn: entry.workedOn,
    deliverableId: entry.deliverableId,
    billable: entry.billable,
    billedInvoiceId: entry.billedInvoiceId,
  }));

  /*
    The project is captured here rather than bound onto the actions, for the
    same reason it is on the scope tab: `.bind` serialises what it carries in
    the clear, so the project an edit is checked against would be whatever the
    caller sent. A `"use server"` function declared in a server component is
    the form the compiler rewrites to encrypt its captured variables.

    The scope list is captured with the edit, so a re-attribution is checked
    against the lines this page actually offered rather than against a fresh
    read that might include a line nobody saw.
  */
  async function edit(previous: EditTimeState, formData: FormData) {
    "use server";
    return writeTimeEntryEdit(projectId, offered, previous, formData);
  }

  async function remove(id: string) {
    "use server";
    return writeTimeEntryDelete(projectId, id);
  }

  return (
    <TimeRows
      entries={listed}
      deliverables={offered}
      edit={edit}
      remove={remove}
    />
  );
}
