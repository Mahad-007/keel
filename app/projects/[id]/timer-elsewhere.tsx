import Link from "next/link";

import { projectTabHref } from "@/lib/projects/detail";

/**
 * What this tab says when the clock is running on another project.
 *
 * It is not a refusal and it is not an error, which is why it is neither red
 * nor a `role="alert"`: nothing has failed, and nothing the reader did caused
 * it. It is a fact about the state of the app, and the useful thing to do with
 * it is to show the way there.
 *
 * The Start form is left out rather than disabled. A form that collects a
 * note and an attribution and then refuses the press is a form that wasted
 * somebody's typing, and the refusal would say the same thing this sentence
 * does — so the sentence is said before the typing rather than after it.
 *
 * The link goes to the other project's time tab rather than its overview,
 * because the clock is the thing being looked for and the time tab is where it
 * is. The project is named in the link text, which is what makes the control
 * worth anything to somebody reading the links on the page out of context.
 */
export function TimerElsewhere({
  projectId,
  projectName,
}: {
  /** The project the clock is running on, which is not this one. */
  projectId: string;
  projectName: string;
}) {
  return (
    <p className="mt-4 max-w-prose rounded border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      A clock is running on another project, and only one can run at a time —
      nobody works on two things at once. Stop it there before starting one
      here:{" "}
      <Link
        href={projectTabHref(projectId, "time")}
        className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
      >
        the clock on {projectName}
      </Link>
      . Time can still be logged by hand below.
    </p>
  );
}
