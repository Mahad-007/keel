---
name: daily-increment
description: Decompose one Keel roadmap milestone into a sequence of atomic, individually-green commits. Use at the start of every autonomous daily run, before writing any code, and whenever deciding where one commit ends and the next begins.
---

# Daily increment

A milestone is a day's work. This is how it becomes ~50 commits that each stand
on their own. The scope of the milestone does not change — only the grain at
which it is committed.

## Plan before you write

Read the milestone, then write the commit sequence down before touching code.
A good sequence is ordered so that **every prefix of it is a working repo** —
if the run dies after commit 7, commits 1–7 are still coherent and shippable.

Order that satisfies that property, most days:

1. Schema change, then its generated migration
2. Types and signatures, before the code that fills them in
3. Pure helpers — each one its own commit, its tests the commit after
4. Data-layer functions, one at a time, tests following each
5. Business logic, one behaviour per commit
6. Server actions, then validation rules one by one
7. UI components — markup, then states, then wiring
8. The page that assembles them
9. Edge cases and empty states, one per commit
10. `/code-review` on the day's diff, then each fix as its own commit

At this grain most units are three commits: the signature, the implementation,
the tests. That is the normal shape, not padding — each one is independently
green and independently readable.

## The test for one commit

Ask: *if I stopped here, would the repo make sense to someone reading it?*

- Yes, and it builds and tests pass → commit it.
- Yes, but the build is red → it is not done. Finish it first.
- No, it only makes sense alongside the next change → they are one commit.

A function without its tests is not a commit. A schema change without its
migration is not a commit. A component nothing renders yet **is** a commit,
provided it compiles and is exercised by a test or a page.

## Verify before each commit

Match the check to what changed, or fifty full Next.js builds will eat the day:

```
npm run verify:fast   # lib/ or tests only — typecheck + vitest
npm run verify        # app/, components/, config, schema — full build + tests
```

Always run the full `npm run verify` before the final commit of the day.

Before each commit, not at the end of the day. That is slower and it is the
whole point: it is what makes every commit independently trustworthy, and what
stops one bad change from poisoning the remaining days.

## Counting honestly

Fifty is the shape a milestone takes when committed at a fine grain. It is not
a quota to satisfy, and it is not a licence to take on more scope — the
milestone is the same size it always was.

If the work is genuinely done at 30 commits, the day is done at 30. If it takes
60, take 60. **Never** manufacture a commit — no formatting-only changes, no
comment touch-ups, no splitting one expression so that neither half means
anything. Padding is worse than a short day, because it makes the history lie
about what happened, and the history is the only record anyone will read.

## When blocked

Write what blocked you to `NOTES.md` — what you tried, what failed, what you
would need. Commit that, and stop. A blocked day recorded honestly is useful.
A blocked day disguised as progress costs the next person a day of archaeology.
