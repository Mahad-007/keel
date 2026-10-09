/**
 * The two writes a project's scope tab can ask for about templates: save this
 * list as one, and add one to this list.
 *
 * No `"use server"` at the top of this file, and that is the point — the same
 * reasoning as `scope-writes.ts`. A `"use server"` module exports an endpoint
 * per function, each POSTable with whatever arguments a caller likes, which
 * would make `projectId` just another field of the submission. These are plain
 * functions; the only registered references are the closures the page declares
 * around them, which capture the project encrypted. They still take the
 * project as a parameter, which is what makes them testable without a page.
 *
 * As everywhere else, the capture says which page made the call and not who
 * was holding it. Phase 8 answers the second question from the session.
 */

import { revalidatePath } from "next/cache";

import {
  saveTemplateFromProject,
  type TemplateCaptureReason,
} from "@/lib/data/deliverable-templates";
import { projectPath } from "@/lib/projects/detail";
import {
  failedSaveState,
  parseTemplateForm,
  readTemplateFields,
  rejectedSaveState,
  SAVE_PROBLEMS,
  savedTemplateState,
  type SaveTemplateState,
} from "@/lib/templates/form";

/**
 * The data layer answers with a code and the reader needs a sentence. The map
 * is exhaustive by its type, so a reason added to the data layer is a
 * compile error here rather than a blank message on a page.
 */
const CAPTURE_PROBLEMS: Record<TemplateCaptureReason, string> = {
  "no-such-project": SAVE_PROBLEMS.missingProject,
  "empty-scope": SAVE_PROBLEMS.emptyScope,
};

/**
 * Saving the project's scope list as a template.
 *
 * It does not redirect, for the same reason the add line does not: the reader
 * is looking at the scope list they just saved, and a template is not a page
 * they asked to go to. What comes back is a sentence naming what was filed.
 *
 * What it does change is the page it was called from, in one place: the
 * picker next to this form now has one more template in it. That is the whole
 * reason for the revalidation — nothing about the project itself moved, and
 * the scope list, the summary and the header all still say exactly what they
 * said before the press.
 */
export async function writeTemplateFromProject(
  projectId: string,
  _previous: SaveTemplateState,
  formData: FormData,
): Promise<SaveTemplateState> {
  const fields = readTemplateFields(formData);

  const parsed = parseTemplateForm(fields);
  if (!parsed.ok) return rejectedSaveState(fields, parsed.errors);

  let result;
  try {
    result = await saveTemplateFromProject(projectId, parsed.value);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("writeTemplateFromProject: failed to save template", error);
    return failedSaveState(fields, SAVE_PROBLEMS.failed);
  }

  if (!result.ok) {
    return failedSaveState(fields, CAPTURE_PROBLEMS[result.reason]);
  }

  // The picker on this page now has one more option in it, and the count
  // beside the form has changed.
  revalidatePath(projectPath(projectId));
  return savedTemplateState(fields, {
    id: result.template.id,
    name: result.template.name,
    lineCount: result.lineCount,
  });
}
