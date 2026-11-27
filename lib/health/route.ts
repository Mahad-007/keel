import type { ProjectStatus } from "@/lib/projects/status";

/**
 * Where the portfolio lives, and what it is called.
 *
 * Its own module, tiny, because three places link here — the home page, the
 * projects list and the page itself — and none of them has any business
 * importing the portfolio's prose or its arithmetic to find out a path. The
 * same job `PROJECTS_PATH` does in `lib/projects/query.ts`, kept separate for
 * the same reason: a string written out at three call sites is a string that
 * goes stale at two of them.
 */

/**
 * The portfolio's path.
 *
 * `/health` rather than `/portfolio` or `/risk`. It is the question the page
 * answers — how is the studio doing — and it is the word somebody types when
 * they want the answer. "Risk" is what the page measures rather than what it
 * is for, and a reader who wanted to know whether anything was going wrong
 * would not think to look for it.
 */
export const HEALTH_PATH = "/health";

/**
 * What the page is called on screen and in the browser tab.
 *
 * "Health" alone, matching the path. The subtitle under it says what is being
 * assessed and how many of them; a heading that tried to say both would be a
 * heading nobody reads twice.
 */
export const HEALTH_TITLE = "Health";

/**
 * The one status the portfolio ranks.
 *
 * Active, and only active. The milestone says every active project, and the
 * reason it says that rather than every project is what the page is for: it
 * answers "what should I do about the work in flight this week", and the three
 * other statuses have nothing in flight.
 *
 * A draft has not been agreed, so there is no contract for a burn to be a
 * share of and no promise anybody is failing to keep. A paused engagement is
 * deliberately not accruing hours, so its gap cannot widen while it sits
 * there — ranking it would put a decision somebody has already taken among the
 * ones they have not. A closed project has whatever it ended up costing, which
 * is a fact for the next quote rather than a problem to catch while there is
 * still budget in the bank.
 *
 * Named here, beside the path, rather than written into the page's query. Its
 * second reader is the integration test, which has to ask the same question
 * the page asks or it is testing a different page — and the day a filter lands
 * on this view, this is the constant that becomes a default.
 */
export const PORTFOLIO_STATUS: ProjectStatus = "active";
