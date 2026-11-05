import { firstParam, type SearchParams } from "@/lib/projects/query";

import {
  DEFAULT_BILLABLE_FILTER,
  parseBillableFilter,
  type BillableFilter,
} from "./billable";
import { ALL_DATES, rangeFromParams, type DateRange } from "./range";

/**
 * Everything the time log reads off the URL: which days, whose work, and
 * whether it is going on an invoice.
 *
 * The URL is the only place this state lives. A filtered log is then a link —
 * the one somebody pastes into a message to say "this is what October came
 * to" — and it survives a reload, works with the back button, and leaves the
 * page a server component with no state of its own. The same arrangement
 * `/projects` uses for its filter and sort and `/time` uses for its week.
 *
 * Four filters that narrow independently, which is the point: "Harbour Co's
 * unbilled time in October" is one question, and a page that could only ask it
 * one filter at a time would be a page somebody exports to a spreadsheet.
 */
export type TimeLogQuery = {
  /** The days to include, either end able to be open. */
  readonly range: DateRange;
  /** The one project to show, or null for every project. */
  readonly projectId: string | null;
  /** The one client to show, or null for every client. */
  readonly clientId: string | null;
  /** Which billing states to show. */
  readonly billable: BillableFilter;
};

/** Where the log lives, so no link has to spell the path out. */
export const TIME_LOG_PATH = "/time/entries";

/**
 * The param names, written once so the parser, the links and the filter
 * form's input names cannot disagree.
 *
 * `project` and `client` rather than `projectId` and `clientId`: the column
 * name is an implementation detail and the URL is read by people.
 */
export const FROM_PARAM = "from";
export const TO_PARAM = "to";
export const PROJECT_PARAM = "project";
export const CLIENT_PARAM = "client";
export const BILLABLE_PARAM = "billable";

/** What `/time/entries` with no params means: every entry there is. */
export const UNFILTERED_LOG: TimeLogQuery = {
  range: ALL_DATES,
  projectId: null,
  clientId: null,
  billable: DEFAULT_BILLABLE_FILTER,
};

/**
 * An id param narrowed to an id, or null when there is nothing in it.
 *
 * Trimmed, and a blank is the same as an absent one. The filter form is a GET
 * form, so an untouched picker submits `project=` rather than nothing at all —
 * and a filter on the empty string would match no project and show a reader an
 * empty log they did not ask for.
 *
 * Nothing checks the id names anything. An id that no longer exists is a
 * filter that matches nothing, which is a fact about the page rather than
 * about the URL, and the page says so beside the picker — refusing it here
 * would mean the log quietly showed every project instead, which is the one
 * answer a reader would misread as the filter having worked.
 */
export function parseIdParam(value: string | undefined): string | null {
  const id = value?.trim() ?? "";
  return id === "" ? null : id;
}

/**
 * Reads a query off the search params, replacing anything unrecognised with
 * no filter on that one field.
 *
 * Every param is independent: a mangled `?from=` does not throw away a good
 * `?project=`, because a URL broken in one place is still a request for the
 * rest of what it asks. The same call `parseProjectsQuery` makes, for the same
 * reason.
 */
export function parseTimeLogQuery(params: SearchParams): TimeLogQuery {
  return {
    range: rangeFromParams(
      firstParam(params[FROM_PARAM]),
      firstParam(params[TO_PARAM]),
    ),
    projectId: parseIdParam(firstParam(params[PROJECT_PARAM])),
    clientId: parseIdParam(firstParam(params[CLIENT_PARAM])),
    billable: parseBillableFilter(firstParam(params[BILLABLE_PARAM])),
  };
}

/**
 * The URL for a query, leaving out anything that is not filtering.
 *
 * Omitting the defaults means the unfiltered log has exactly one address —
 * `/time/entries` — rather than sixteen that render the same list. That
 * matters for marking a preset link as current, where comparing a range
 * against the one on screen is how a link knows it points at where the reader
 * already is, and it keeps the address a reader pastes into a message down to
 * the filters they actually set.
 *
 * The params go on in the order they are read in the heading — days, then
 * whose work, then the billing state — so two links to the same log are the
 * same string rather than the same set of params shuffled.
 */
export function timeLogHref(query: TimeLogQuery): string {
  const params = new URLSearchParams();
  if (query.range.from !== null) params.set(FROM_PARAM, query.range.from);
  if (query.range.to !== null) params.set(TO_PARAM, query.range.to);
  if (query.clientId !== null) params.set(CLIENT_PARAM, query.clientId);
  if (query.projectId !== null) params.set(PROJECT_PARAM, query.projectId);
  if (query.billable !== DEFAULT_BILLABLE_FILTER) {
    params.set(BILLABLE_PARAM, query.billable);
  }
  const search = params.toString();
  return search === "" ? TIME_LOG_PATH : `${TIME_LOG_PATH}?${search}`;
}
