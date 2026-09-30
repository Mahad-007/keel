"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { projectClientOptions } from "@/lib/clients/picker";
import { createProject } from "@/lib/data/projects";
import { hasFieldError } from "@/lib/forms/result";
import { failedFormState, rejectedFormState } from "@/lib/forms/state";
import { projectPath } from "@/lib/projects/detail";
import {
  parseProjectForm,
  readProjectFields,
  type ProjectFormState,
} from "@/lib/projects/form";
import { NEW_PROJECT_PATH, PROJECTS_PATH } from "@/lib/projects/query";

/**
 * Creating a project. The same four steps as creating a client — read,
 * validate, write, leave — with one addition: the picked client is checked
 * against the clients actually on offer, read here rather than trusted from the
 * submission. A form is a POST endpoint, and the id in it can name a client
 * that was archived while the page sat open, or one that was never offered.
 *
 * On success it does not return — it redirects, so a refresh cannot resubmit
 * the form and create a second project.
 */
/**
 * Said when the picker is empty by the time the form comes back. It replaces
 * "choose another", which would be asking for something that cannot be done.
 */
const NO_CLIENTS_LEFT =
  "There are no clients left to file a project under. Restore one from the archived list, or add a new client, and this form will keep what you typed.";

export async function createProjectAction(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const fields = readProjectFields(formData);

  const clients = await projectClientOptions();
  const clientIds = clients.map((client) => client.id);
  const parsed = parseProjectForm(fields, clientIds);
  if (!parsed.ok) {
    /**
     * The picker on screen was read before this rejection, so when the picker is
     * what failed the reader is being told to choose again from a list that is
     * out of date. Revalidating sends the page's current options back with the
     * message. A blank pick counts too — nothing to choose from is the likeliest
     * reason nothing was chosen.
     *
     * Except when the client book has emptied, which is the one case where the
     * page would render its "no clients" panel instead of the form: that
     * unmounts the form and takes the typed name and figures with it. So the
     * form stays, keeping what was typed, and says what happened itself.
     */
    if (hasFieldError(parsed.errors, "client")) {
      if (clientIds.length === 0) {
        return rejectedFormState(fields, {
          ...parsed.errors,
          client: NO_CLIENTS_LEFT,
        });
      }
      revalidatePath(NEW_PROJECT_PATH);
    }
    return rejectedFormState(fields, parsed.errors);
  }

  let project;
  try {
    project = await createProject(parsed.value);
  } catch (error) {
    // The user cannot act on a driver error, but the logs should keep it.
    console.error("createProjectAction: failed to write project", error);
    return failedFormState(
      fields,
      "Could not save the project. Nothing was written — try again.",
    );
  }

  // To the project, not back to the list: the reason for creating one is to
  // start filling it in, and its own page is where that happens.
  // Outside the try, because `redirect` signals by throwing and catching it
  // here would turn a successful save into a "could not save" message.
  revalidatePath(PROJECTS_PATH);
  redirect(projectPath(project.id));
}
