# Notes

## Day 013 ran twice

Day 013 — deliverable status toggling, move up/down, optimistic UI — was built
on 2026-10-04 in 61 commits (`c9fed04..52f303e`). That run ended before the
workflow ticked the box, so the next run picked Day 013 again on 2026-10-05 and
found the milestone already delivered and green.

Rather than rebuild it or pad the history, 2026-10-05 audited what was there
and fixed what the review found. Both findings were in `scope-rows.tsx`, and
both were about what the reader is told when a press does not land:

- A server action that *rejects* rather than returning a refusal — a dropped
  connection, a suspended tab — threw out of the form action instead of
  explaining itself. `SCOPE_NO_ANSWER` is deliberately not one of
  `SCOPE_PROBLEMS`: those sentences can say nothing was written, and this one
  cannot know.
- A refused press cleared the whole live region, including a later press's
  sentence. Presses are queued and answered in order, so press 1 failing could
  silence press 2's "is now done." moments after it was inserted, and press 2
  never says it twice. `withdrawAnnouncement` takes back one press's sentence
  and nobody else's.

So Day 013's history is spread across two dates. Nothing is missing, and
`npm run verify` is green at both ends.

## Pre-existing, left alone

`npm run lint` reports seven `no-require-imports` errors in `scripts/*.js`.
They predate Day 013, are not in any milestone, and CI runs `npm run verify`
rather than `npm run lint`, so nothing is red because of them. Worth a commit
on a day that owns those files.
