"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { projectClientOptions } from "@/lib/clients/picker";
import { createProject } from "@/lib/data/projects";
import { failedFormState, rejectedFormState } from "@/lib/forms/state";
import { projectPath } from "@/lib/projects/detail";
import {
  parseProjectForm,
  pickerWentStale,
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
export async function createProjectAction(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const fields = readProjectFields(formData);

  const clients = await projectClientOptions();
  const clientIds = clients.map((client) => client.id);
  const parsed = parseProjectForm(fields, clientIds);
  if (!parsed.ok) {
    // The picker the reader is looking at offered a client this action has just
    // refused, so it was read before that client was archived. Revalidating
    // sends the page's options back with the rejection, which is what makes
    // "choose another" something they can do without reloading — and if that
    // was the last client, the page says so instead of offering a form.
    if (pickerWentStale(fields.client, clientIds)) {
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
