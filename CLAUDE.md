# Working in this repo

You are building Keel one roadmap milestone per day, unattended. Nobody
reviews your work until it is already pushed, so the bar is: **leave the repo
in a state the next run can build on.** A half-finished feature that breaks the
build costs every remaining day, not just this one.

## The shape of a day

One milestone from `ROADMAP.md`, decomposed into **roughly 20 atomic commits**.
Twenty is a target, not a quota — a milestone that genuinely takes 14 commits
takes 14. What is never acceptable is padding the count with commits that
deliver nothing.

**You commit as you go.** Do not save everything for one commit at the end.
Work, commit, work, commit. If the run is cut short — quota, timeout, network —
everything committed so far is preserved and tomorrow continues from there.

### What an atomic commit is

A complete, working unit. The build passes and the tests pass **at that
commit**, not merely at the end of the day. Typical shapes:

- a schema change plus its generated migration
- one data-layer function plus its tests
- one pure function plus its tests
- one component, wired and rendering
- one server action plus its validation tests
- a refactor that changes structure and nothing else

### What an atomic commit is not

- a README or comment touch-up with no code behind it
- a formatting-only change made to inflate the count
- "wip", "fixes", "more work", or any message that does not say what changed
- a commit that leaves the build red, to be fixed in the next one
- splitting one logical change across several commits purely to reach twenty

Twenty real commits is the goal. **Five real commits beats twenty padded
ones** — if you find yourself inventing work to hit the number, stop and commit
what is genuinely done.

### Commit messages

Imperative subject under 72 characters, saying what changed and why it matters.
`Add scope creep classifier with burn-versus-completion cases` — not
`update lib`. A body is worth writing whenever the reasoning is not obvious
from the diff.

## The rules that matter

1. **`npm run build` and `npm test` must pass before every commit.** Run them.
   Never commit red.
2. **Do exactly one roadmap milestone.** Don't run ahead — later milestones
   depend on decisions made in earlier ones.
3. **Don't touch `ROADMAP.md`.** The workflow ticks the box for you.
4. **Don't push, branch, rebase, or amend.** Commit to the current branch and
   let the workflow push.
5. If the milestone is genuinely blocked, write what blocked you to `NOTES.md`,
   commit that, and stop. Don't fake it and don't paper over it.

## Skills

Use the skills available to you where they apply, rather than reinventing what
they cover:

- **`/code-review`** — run it before your final commit each day, on the day's
  diff, and fix what it finds. This is the closest thing to review this code
  gets.
- **`/security-review`** — run it on any day that touches authentication,
  sessions, passwords, user-scoped queries, or input validation. Phase 8 in
  particular.
- **`dataviz`** — read it before writing any chart, including the server-side
  SVG work in Days 036, 076 and the burn-down views.
- **`/simplify`** — worth a pass on a day that produced a lot of surface area.

The repo's own `.claude/skills/` take precedence over general habits.

## Conventions

- **Money is integer cents.** Use `lib/money.ts`. A float never touches a
  currency value.
- **Time is whole minutes.** Not hours, not seconds.
- **Data access lives in `lib/data/`**, one module per table, exporting plain
  async functions taking an optional `Database` handle. Pages and server
  actions call those — never Drizzle directly from a component.
- **Business logic lives in pure functions** under `lib/`, separate from data
  access, so it can be tested without a database. The scope, rate, and
  invoicing calculations are the heart of the product; test them properly,
  including the boundaries and the degenerate cases.
- **Server components by default.** Reach for `"use client"` only for genuine
  interactivity, and keep those components small.
- **Tests** are `*.test.ts` beside the code, run by Vitest. Test behaviour and
  edge cases, not getters.
- Dates are ISO strings in the database. Money and minutes are integers.
- After a schema change run `npm run db:generate` and commit the migration.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · libSQL ·
Vitest. Schema in `lib/db/schema.ts`.

## Taste

Plain, dense, readable. This is a tool for someone who looks at it all day, not
a landing page. Real typography, real spacing, no gradient hero sections, no
emoji in the UI. Prefer a clear table over a chart, and a sentence explaining
*why* something is flagged over a coloured dot that leaves the user guessing.
