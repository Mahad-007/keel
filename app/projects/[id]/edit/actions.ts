"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { projectClientOptions } from "@/lib/clients/picker";
import { getProject, updateProject } from "@/lib/data/projects";
import { failedFormState, rejectedFormState } from "@/lib/forms/state";
import { projectEditPath, projectPath } from "@/lib/projects/detail";
import {
  parseProjectForm,
  pickerWentStale,
  projectFormChanges,
  readProjectFields,
  type ProjectFormState,
} from "@/lib/projects/form";
import { PROJECTS_PATH } from "@/lib/projects/query";

/** Said in two places, so the two cannot drift into different sentences. */
const GONE = "That project no longer exists. Nothing was saved.";

/**
 * Saving an edit. The same steps as creating a project — read, validate, write,
 * leave — over a row that already exists, plus one the new form does not need:
 * the project is read first, because which clients it may be filed under
 * depends on which one it is filed under now. An archived client stays on offer
 * for the project that is already theirs, and for no other project.
 *
 * The id is bound by the page that rendered the form rather than carried in a
 * hidden input, so no field of the form names the row it overwrites and a
 * renamed or injected input cannot retarget the save.
 *
 * That is tidiness, not a permission check: a server action is a POST endpoint,
 * and a crafted request can pass whatever id it likes. Nothing is lost by that
 * today — there are no accounts, so every project is already every visitor's to
 * edit — but the check that makes this id *theirs* belongs here, inside the
 * action, when Phase 8 adds accounts.
 */
export async function updateProjectAction(
  id: string,
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const fields = readProjectFields(formData);

  // The row was read to render the form and deleted before it was submitted.
  // Rare, but it is not a field error and it is not a crash.
  const current = await getProject(id);
  if (current === null) return failedFormState(fields, GONE);

  const clients = await projectClientOptions(current.clientId);
  const clientIds = clients.map((client) => client.id);
  const parsed = parseProjectForm(fields, clientIds);
  if (!parsed.ok) {
    // The options on screen are older than this rejection: they offered a
    // client who has since been archived, and telling the reader to choose
    // another while the list still shows that one is a dead end. Revalidating
    // sends the current options back with the message. The project's own client
    // is never the one refused — the picker keeps them either way.
    if (pickerWentStale(fields.client, clientIds)) {
      revalidatePath(projectEditPath(id));
    }
    return rejectedFormState(fields, parsed.errors);
  }

  /**
   * Only what moved. The data layer writes nothing for an empty patch, which is
   * what keeps Save on an untouched form from bumping `updatedAt` and jumping
   * the project to the top of a list sorted by it.
   */
  const changes = projectFormChanges(current, parsed.value);

  let saved;
  try {
    saved = await updateProject(id, changes);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("updateProjectAction: failed to save project", error);
    return failedFormState(
      fields,
      "Could not save the changes. Nothing was written — try again.",
    );
  }

  // Deleted between the two reads. The same message: from the user's side
  // nothing distinguishes the two moments.
  if (saved === null) return failedFormState(fields, GONE);

  // Back to the project, which is where the change is visible — the header
  // carries the contract value and the client this form just set.
  // Outside the try: `redirect` signals by throwing, and catching it here
  // would turn a successful save into a "could not save" message.
  revalidatePath(PROJECTS_PATH);
  revalidatePath(projectPath(id));
  revalidatePath(projectEditPath(id));
  redirect(projectPath(id));
}
