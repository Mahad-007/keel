import type { Metadata } from "next";
import Link from "next/link";

import { listArchivedClients } from "@/lib/data/clients";
import { formatDate } from "@/lib/dates";
import type { Client } from "@/lib/db/schema";

import { unarchiveClientAction } from "../actions";
import { SubmitButton } from "../submit-button";

/**
 * Read at request time for the same reason the active list is: a client
 * archived a minute ago belongs here, not in a page cached at deploy time.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archived clients · Keel",
};

export default async function ArchivedClientsPage() {
  const clients = await listArchivedClients();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 font-sans">
      <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link
          href="/clients"
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Archived clients
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Archiving hides a client; it never deletes one. Every row below is
          still in the database with its projects, time and invoices intact,
          and restoring one puts it back on the client list under the same id.
        </p>
      </header>

      <ArchivedTable clients={clients} />
    </main>
  );
}

function ArchivedTable({ clients }: { clients: Client[] }) {
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-6 font-medium">
            Name
          </th>
          <th scope="col" className="py-2 pr-6 font-medium">
            Company
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            Archived
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            <span className="sr-only">Restore</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <tr
            key={client.id}
            className="border-b border-zinc-100 dark:border-zinc-900"
          >
            <td className="py-2.5 pr-6 font-medium text-zinc-900 dark:text-zinc-100">
              <Link
                href={`/clients/${client.id}/edit`}
                className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
              >
                {client.name}
              </Link>
            </td>
            <td className="py-2.5 pr-6 text-zinc-700 dark:text-zinc-300">
              {client.company ?? (
                <span className="text-zinc-400 dark:text-zinc-600">—</span>
              )}
            </td>
            <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
              {client.archivedAt === null ? "—" : formatDate(client.archivedAt)}
            </td>
            <td className="py-2.5 text-right">
              <form action={unarchiveClientAction.bind(null, client.id)}>
                <SubmitButton variant="secondary" pendingLabel="Restoring…">
                  Restore
                </SubmitButton>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
