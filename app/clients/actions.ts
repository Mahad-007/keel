"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { archiveClient } from "@/lib/data/clients";

/**
 * Archiving and restoring a client. Neither takes a form: the id is bound by
 * the page that rendered the button, and there is nothing else to say.
 *
 * Both are posted, never linked. A GET that changes a row is one prefetch or
 * one crawler away from archiving a client nobody touched.
 */

/**
 * Soft delete. The client drops off `/clients` and the row stays exactly
 * where it was, which is what makes the button safe to press: the restore
 * path on `/clients/archived` puts it back under the same id.
 *
 * Redirects to the list, so the result of pressing it — the client is no
 * longer there — is the next thing the user sees.
 */
export async function archiveClientAction(id: string): Promise<void> {
  const archived = await archiveClient(id);

  // The page was rendered from a row that has since been deleted outright.
  // Saying so beats redirecting to a list and implying it worked.
  if (archived === null) notFound();

  revalidatePath("/clients");
  revalidatePath("/clients/archived");
  redirect("/clients");
}
