import { getClient, listClients } from "@/lib/data/clients";
import { db, type Database } from "@/lib/db";

import { clientOptions, type ClientOption } from "./options";

/**
 * The clients a project form may file a project under.
 *
 * Both halves of a form need this list and they must not disagree: the page
 * renders it as the options, and the action checks the submitted id against it.
 * Two spellings of "which clients are on offer" is how a form ends up showing a
 * client it then refuses to save, or accepting one it never showed.
 *
 * `currentClientId` is the client an existing project is already on, which is
 * offered whether or not they are still active — archiving a client does not
 * unfile their projects, and a picker missing its own project's client is one
 * that reassigns the project as soon as anything else is saved.
 */
export async function projectClientOptions(
  currentClientId: string | null = null,
  database: Database = db,
): Promise<ClientOption[]> {
  /**
   * The current client is fetched by id rather than found in the list, because
   * the case that matters is exactly the one where they are not in it. Both
   * reads are independent, so they go together.
   */
  const [active, current] = await Promise.all([
    listClients(database),
    currentClientId === null
      ? Promise.resolve(null)
      : getClient(currentClientId, database),
  ]);

  return clientOptions(active, current);
}
