import type { Metadata } from "next";
import Link from "next/link";

import { readProgress } from "@/lib/progress";

/**
 * Statically rendered, so the roadmap is read on the builder rather than per
 * request. Every deploy refreshes the numbers; nothing here touches the
 * database.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Keel — know a project is going over while you can still bill for it",
  description:
    "An operations system for independent studios, built around the gap between what you contracted to deliver and what you are actually delivering.",
};

const BUILT: { href: string; name: string; note: string }[] = [
  { href: "/clients", name: "Clients", note: "Everyone on the books, with their default rate." },
  { href: "/clients/new", name: "Add a client", note: "Name, company, contact, hourly rate." },
  { href: "/clients/archived", name: "Archive", note: "Past clients, kept with their history intact." },
];

export default function Home() {
  const { done, total, next } = readProgress();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 font-sans">
      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Keel
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          An operations system for independent studios, built around one idea
          most project tools miss: scope is a contract, and it leaks.
        </p>
      </header>

      <section className="mt-10 max-w-2xl space-y-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <p>
          Studios rarely lose money on work they priced wrong. They lose it on
          work they priced correctly and then quietly over-delivered — the extra
          revision, the quick call, the feature that was never in the statement
          of work. Each is small enough to absorb, and together they turn a
          profitable engagement into a break-even one.
        </p>
        <p>
          Keel watches the gap between what you contracted to deliver and what
          you are actually delivering, and flags a project while you can still
          do something about it.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Built so far
        </h2>
        <ul className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {BUILT.map((page) => (
            <li key={page.href} className="py-3">
              <Link
                href={page.href}
                className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
              >
                {page.name}
              </Link>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                {page.note}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Under construction
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Keel is being built one milestone a day, unattended, by Claude Code
          running in GitHub Actions. <strong>{done} of {total}</strong>{" "}
          milestones are done.
          {next ? (
            <> Next up is {next.label}: {next.summary.toLowerCase()}.</>
          ) : (
            <> The roadmap is complete.</>
          )}{" "}
          The scope tracking this page describes is the second half of that
          plan, so it is not here yet — what exists today is the client book.
        </p>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          <a
            href="https://github.com/Mahad-007/keel"
            className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Source and roadmap on GitHub
          </a>
        </p>
      </section>
    </main>
  );
}
