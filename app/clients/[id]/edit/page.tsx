import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { clientFormStateFor } from "@/lib/clients/form";
import { getClient } from "@/lib/data/clients";

import { EditClientForm } from "./client-form";

/**
 * Read at request time, like the list. A client edited a minute ago and
 * served from a build-time cache is a form that silently discards the last
 * change made to it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit client · Keel",
};

export default async function EditClientPage({
  params,
}: PageProps<"/clients/[id]/edit">) {
  const { id } = await params;
  const client = await getClient(id);

  // `getClient` finds archived clients too: an archived row is still editable,
  // and the page says so rather than pretending the client is gone.
  if (client === null) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 font-sans">
      <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link
          href="/clients"
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {client.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Changing the default rate affects projects that have no rate of their
          own, from now on. Work already logged keeps the rate it was billed at.
        </p>
      </header>

      <EditClientForm
        clientId={client.id}
        initialState={clientFormStateFor(client)}
      />
    </main>
  );
}
