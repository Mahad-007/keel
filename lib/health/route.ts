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
