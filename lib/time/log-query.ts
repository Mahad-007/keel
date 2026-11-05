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
