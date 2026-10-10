/**
 * The write behind the duplicate button: copy this project, go to the copy.
 *
 * No `"use server"` at the top of this file, and that is the point — the same
 * reasoning as `template-writes.ts`. A `"use server"` module exports an
 * endpoint per function, each POSTable with whatever arguments a caller likes,
 * which would make `projectId` just another field of the submission. This is a
 * plain function; the only registered reference is the closure the page
 * declares around it, which captures the project encrypted. It still takes the
 * project as a parameter, which is what makes it testable without a page.
 *
 * As everywhere else, the capture says which page made the call and not who
 * was holding it. Phase 8 answers the second question from the session.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  duplicateProject,
  type DuplicateProjectReason,
} from "@/lib/data/projects";
import { failedFormState, rejectedFormState } from "@/lib/forms/state";
import { projectPath } from "@/lib/projects/detail";
import {
  DUPLICATE_PROBLEMS,
  parseDuplicateForm,
  readDuplicateFields,
  type DuplicateFormState,
} from "@/lib/projects/duplicate-form";
import { PROJECTS_PATH } from "@/lib/projects/query";

/**
 * The data layer answers with a code and the reader needs a sentence. The map
 * is exhaustive by its type, so a reason added to the data layer is a compile
 * error here rather than a blank message on a page.
 */
const DUPLICATE_REASONS: Record<DuplicateProjectReason, string> = {
  "no-such-project": DUPLICATE_PROBLEMS.missingProject,
  "negative-estimate": DUPLICATE_PROBLEMS.negativeEstimate,
};

/**
 * Copying the project this page is about.
 *
 * It redirects, unlike the template writes, and for the opposite reason:
 * saving a template leaves the reader looking at the thing they saved, while a
 * copy is somewhere else entirely and is the thing they now want to work on —
 * its scope list to prune, its contract value to change, its status to move.
 * Staying put would also leave the button exactly where it was, inviting a
 * second press and a second copy.
 *
 * The project list gains a row, so it is revalidated on the way out. The
 * source project's own page is not: nothing about it changed, which is the
 * guarantee the whole feature rests on.
 */
export async function writeDuplicatedProject(
  projectId: string,
  _previous: DuplicateFormState,
  formData: FormData,
): Promise<DuplicateFormState> {
  const fields = readDuplicateFields(formData);

  const parsed = parseDuplicateForm(fields);
  if (!parsed.ok) return rejectedFormState(fields, parsed.errors);

  let result;
  try {
    result = await duplicateProject(projectId, parsed.value);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("writeDuplicatedProject: failed to copy project", error);
    return failedFormState(fields, DUPLICATE_PROBLEMS.failed);
  }

  if (!result.ok) {
    return failedFormState(fields, DUPLICATE_REASONS[result.reason]);
  }

  // Outside the try: `redirect` signals by throwing, and catching it here
  // would turn a successful copy into a "could not copy" message.
  revalidatePath(PROJECTS_PATH);
  redirect(projectPath(result.project.id));
}
