# Working in this repo

You are building Keel one roadmap task per day, unattended. Nobody reviews your
work until day 30, so the bar is: **leave the repo in a state the next run can
build on.** A half-finished feature that breaks the build costs every remaining
day, not just this one.

## The rules that matter

1. **`npm run build` and `npm test` must both pass before you finish.** Run
   them. If something fails, fix it. Never finish on a red build.
2. **Do exactly one roadmap task.** Don't run ahead — later tasks depend on
   decisions made in earlier ones, and a day that does four things badly is
   worse than a day that does one thing well.
3. **Don't touch `ROADMAP.md`.** The workflow ticks the box for you.
4. **Don't commit, push, or branch.** The workflow handles git.
5. If a task turns out to be genuinely blocked, write what blocked you to
   `NOTES.md` and stop. Don't fake it, and don't paper over it.

## Conventions

- **Money is integer cents.** Use `lib/money.ts`. A float never touches a
  currency value.
- **Time is whole minutes.** Not hours, not seconds.
- **Data access lives in `lib/data/`**, one module per table, exporting plain
  async functions. Pages and server actions call those — never Drizzle
  directly from a component.
- **Business logic lives in pure functions** under `lib/`, separate from data
  access, so it can be tested without a database. The scope and invoicing
  calculations are the heart of the product; test them properly.
- **Server components by default.** Reach for `"use client"` only when you need
  interactivity, and keep those components small.
- **Tests** are `*.test.ts` beside the code, run by Vitest. Test behaviour and
  edge cases, not getters.
- Dates are ISO strings in the database. Money and minutes are integers.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · libSQL ·
Vitest. Schema in `lib/db/schema.ts`; after changing it run
`npm run db:generate` and commit the generated migration in `drizzle/`.

## Taste

Plain, dense, readable. This is a tool for someone who looks at it all day, not
a landing page. Real typography, real spacing, no gradient hero sections, no
emoji in the UI. Prefer a clear table over a chart, and a sentence explaining
*why* something is flagged over a coloured dot that leaves the user guessing.
