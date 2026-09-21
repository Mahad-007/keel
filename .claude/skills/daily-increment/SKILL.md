---
name: daily-increment
description: Decompose one Keel roadmap milestone into a sequence of atomic, individually-green commits. Use at the start of every autonomous daily run, before writing any code, and whenever deciding where one commit ends and the next begins.
---

# Daily increment

A milestone is a day's work. This is how it becomes ~20 commits that each stand
on their own.

## Plan before you write

Read the milestone, then write the commit sequence down before touching code.
A good sequence is ordered so that **every prefix of it is a working repo** —
if the run dies after commit 7, commits 1–7 are still coherent and shippable.

Order that satisfies that property, most days:

1. Schema change and its generated migration
2. Types and pure helpers the rest will import
3. Data-layer functions, each with its tests
4. Business logic as pure functions, each with its tests
5. Server actions and validation
6. UI components, smallest first
7. The page that assembles them
8. Edge cases, empty states, error handling
9. `/code-review` on the day's diff, then its fixes

## The test for one commit

Ask: *if I stopped here, would the repo make sense to someone reading it?*

- Yes, and it builds and tests pass → commit it.
- Yes, but the build is red → it is not done. Finish it first.
- No, it only makes sense alongside the next change → they are one commit.

A function without its tests is not a commit. A schema change without its
migration is not a commit. A component nothing renders yet **is** a commit,
provided it compiles and is exercised by a test or a page.

## Verify before each commit

```
npm run build && npm test
```

Not at the end of the day — before each commit. This is slower and it is the
whole point: it is what makes every commit independently trustworthy, and it
is what stops one bad change from poisoning the remaining days.

## Counting honestly

Twenty is the target because a real milestone genuinely decomposes into about
that many units. It is not a quota to satisfy.

If the work is done at 12 commits, the day is done at 12. If it needs 26, take
26. **Never** manufacture a commit — no formatting-only changes, no comment
touch-ups, no splitting a coherent change in half. Padding the count is worse
than a short day, because it makes the history lie about what happened.

## When blocked

Write what blocked you to `NOTES.md` — what you tried, what failed, what you
would need. Commit that, and stop. A blocked day recorded honestly is useful.
A blocked day disguised as progress costs the next person a day of archaeology.
