import type { Client } from "@/lib/db/schema";

import { archiveClientAction } from "../../actions";
import { SubmitButton } from "../../submit-button";

/**
 * The end of the edit page: taking a client off the list.
 *
 * There is no "are you sure?" step, and that is deliberate. The button says
 * exactly what it does, nothing is deleted, and the archive puts it back
 * under the same id — a confirmation dialogue in front of a reversible action
 * teaches people to dismiss confirmations in front of irreversible ones.
 */
export function ArchiveSection({ client }: { client: Client }) {
  return (
    <section className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Archive
      </h2>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Archiving takes {client.name} off the client list. Nothing is deleted:
        projects, time and invoices go on pointing at this client, and you can
        restore it from the archive whenever you like.
      </p>
      <form action={archiveClientAction.bind(null, client.id)} className="mt-3">
        <SubmitButton variant="secondary" pendingLabel="Archiving…">
          Archive client
        </SubmitButton>
      </form>
    </section>
  );
}
