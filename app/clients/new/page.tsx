import type { Metadata } from "next";

import { NewClientForm } from "./client-form";

export const metadata: Metadata = {
  title: "New client · Keel",
};

export default function NewClientPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 font-sans">
      <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          New client
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Only a name is required. Everything else can be filled in later, and
          the default rate is what a project falls back to when it has no rate
          of its own.
        </p>
      </header>

      <NewClientForm />
    </main>
  );
}
