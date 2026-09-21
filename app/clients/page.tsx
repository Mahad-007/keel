import type { Metadata } from "next";
import Link from "next/link";

import { listClients } from "@/lib/data/clients";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { Client } from "@/lib/db/schema";

/**
 * Every client row is read at request time. The build machine has no database,
 * and a list of clients cached at deploy time would be wrong the moment
 * someone adds one.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients · Keel",
};

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 font-sans">
      <header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Clients
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {clients.length === 0
              ? "Nobody on the books yet."
              : `${clients.length} ${clients.length === 1 ? "client" : "clients"}. Archived clients keep their history but drop off this list.`}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="shrink-0 rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          New client
        </Link>
      </header>

      {clients.length === 0 ? <EmptyState /> : <ClientsTable clients={clients} />}
    </main>
  );
}

function ClientsTable({ clients }: { clients: Client[] }) {
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
            Default rate
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Created
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
              {client.name}
            </td>
            <td className="py-2.5 pr-6 text-zinc-700 dark:text-zinc-300">
              {client.company ?? (
                <span className="text-zinc-400 dark:text-zinc-600">—</span>
              )}
            </td>
            <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
              {client.defaultRateCents === 0 ? (
                <span className="text-zinc-400 dark:text-zinc-600">Not set</span>
              ) : (
                `${formatCents(client.defaultRateCents)}/hr`
              )}
            </td>
            <td className="py-2.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatDate(client.createdAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded border border-dashed border-zinc-300 px-6 py-10 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        No clients yet.
      </p>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        A client is the root of everything else in Keel: projects hang off a
        client, and a project&rsquo;s billing rate falls back to the client&rsquo;s
        default when it has no override of its own. Add one to get started.
      </p>
      <Link
        href="/clients/new"
        className="mt-4 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
      >
        Add your first client
      </Link>
    </div>
  );
}
