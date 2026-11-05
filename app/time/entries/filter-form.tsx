import { DateField, SelectField } from "@/components/form";
import {
  BILLABLE_FILTERS,
  billableFilterLabel,
} from "@/lib/time/billable";
import {
  EVERY_CLIENT_LABEL,
  EVERY_PROJECT_LABEL,
  type FilterOption,
} from "@/lib/time/log-options";
import {
  BILLABLE_PARAM,
  CLIENT_PARAM,
  FROM_PARAM,
  PROJECT_PARAM,
  TIME_LOG_PATH,
  TO_PARAM,
  type TimeLogQuery,
} from "@/lib/time/log-query";

/**
 * The four filters, as a form that navigates.
 *
 * A GET form rather than a server action, which is what makes the filters live
 * in the URL: pressing Apply is a navigation to the same page with different
 * search params, so there is no client JavaScript, the back button steps
 * through the filters a reader tried, and a log they want somebody else to see
 * is the address bar.
 *
 * The input names *are* the param names, imported from the same place the
 * parser reads them from — a form submitting `projectId=` against a parser
 * reading `project=` is a filter that silently does nothing.
 *
 * Every control is rendered with its current value as its default, which is
 * what makes the form a picture of the filters rather than a blank slate over
 * a filtered list. A box the reader empties submits an empty value, which
 * parses back to no filter on that field.
 */
export function FilterForm({
  query,
  projects,
  clients,
}: {
  query: TimeLogQuery;
  /** The projects the log can be narrowed to, already narrowed to the client. */
  projects: readonly FilterOption[];
  clients: readonly FilterOption[];
}) {
  return (
    <form
      method="get"
      action={TIME_LOG_PATH}
      aria-label="Filter the time log"
      className="mt-6 rounded border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DateField
          name={FROM_PARAM}
          label="From"
          defaultValue={query.range.from ?? ""}
        />
        <DateField
          name={TO_PARAM}
          label="To"
          hint="Both days are included."
          defaultValue={query.range.to ?? ""}
        />
        <SelectField
          name={CLIENT_PARAM}
          label="Client"
          placeholder={EVERY_CLIENT_LABEL}
          options={clients}
          defaultValue={query.clientId ?? ""}
        />
        {/*
          The project list is narrowed to whichever client is filtered on *as
          the page was served*, not as the picker beside it currently reads.
          Narrowing it live would need JavaScript, so it is one press behind:
          changing the client and pressing Apply can submit the old client's
          project alongside the new client, which is a pair no entry can match.

          That is a state the page explains rather than one the form prevents.
          A form cannot know what the other picker has been changed to without
          JavaScript, and the two honest ways out — ignoring one of the two
          filters, or refusing the submission — both answer a press with
          something the URL does not say. So the log says which project does
          not belong to which client and offers to drop the project, which is
          the rule `withClient` applies to the links that can see both.
        */}
        <SelectField
          name={PROJECT_PARAM}
          label="Project"
          placeholder={EVERY_PROJECT_LABEL}
          options={projects}
          defaultValue={query.projectId ?? ""}
        />
        <SelectField
          name={BILLABLE_PARAM}
          label="Billing"
          options={BILLABLE_FILTERS.map((filter) => ({
            value: filter,
            label: billableFilterLabel(filter),
          }))}
          defaultValue={query.billable}
        />
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
