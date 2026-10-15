# Notes

## Day 013 ran twice

Day 013 — deliverable status toggling, move up/down, optimistic UI — was built
on 2026-10-04 in 61 commits (`c9fed04..52f303e`). That run ended before the
workflow ticked the box, so the next run picked Day 013 again on 2026-10-05 and
found the milestone already delivered, with `npm run verify` green.

Rather than rebuild it or pad the history, 2026-10-05 audited what was there and
fixed what review found. So Day 013's history is spread across two dates, and
the second date is short on purpose. Nothing is missing.

## What the audit changed

Two correctness findings, both in `scope-rows.tsx`, both about what the reader
is told when a press does not land:

- A server action that *rejects* rather than returning a refusal — a dropped
  connection, a suspended tab — threw out of the form action instead of
  explaining itself. `SCOPE_NO_ANSWER` is deliberately not one of
  `SCOPE_PROBLEMS`: those sentences can say nothing was written, and this one
  cannot know, so it does not claim it.
- A refused press cleared the whole live region, including a later press's
  sentence. Presses are queued and answered in order, so press 1 failing could
  wipe press 2's "is now done." moments after it was inserted, and press 2 never
  says it twice. `withdrawAnnouncement` takes back one press's sentence only.

## How the project id stopped being forgeable

The security pass found that `projectDeliverable()`'s check — that a deliverable
belongs to the project the press names — compared two caller-supplied values,
because `projectId` was an ordinary server-action argument. It took **three**
attempts, and the two failures are the useful part of this note:

1. **Moving `.bind(null, projectId)` from the client component to the server
   component changes nothing.** `registerServerReference`'s `bind` only does
   `$$bound.concat(args)`, and those values are serialised in the clear wherever
   the `.bind` is written. Only a `"use server"` function *declared inside a
   server component* is rewritten to encrypt what it captures.
2. **Adding those closures is not enough on its own.** A `"use server"` module
   registers one POST endpoint per export, so the three writes stayed directly
   callable with any `projectId`; the closures only added a safe path beside the
   open one. They had to stop being exports of a `"use server"` module at all —
   hence `scope-writes.ts`, plain async functions, with the page's closures as
   the only registered references.

Both failures look right and neither is, which is why the claim is checked
against the build and not from memory:

```
rm -rf .next && npm run build
grep -rho 'encryptActionBoundArgs)("[0-9a-f]*"' .next/server/chunks/ssr/*.js | wc -l   # 8
python3 -c "import json;m=json.load(open('.next/server/server-reference-manifest.json'));print(len([k for k,v in m['node'].items() if 'app/projects/[id]/page' in v['workers']]))"
```

Eight encrypted captures, and nine references for the project page — the eight
closures plus Day 010's `transitionProjectAction`, which is still a bare export.
If either number moves, the check has stopped being one.

The first command no longer constrains what follows the id, and that is a
correction rather than a tidy-up. It used to end `",[a-z]*)`, which only matches
a closure capturing one plainly-named variable, and two of the eight are not
that: the scope tab's template apply captures two values (`a,u`), and this
milestone's duplicate closure captures `project.id`, a member expression
(`a.id`). Both compile to exactly the same encrypted form; the regex simply
could not see them. It was accurate through Day 014 and has undercounted since
Day 017 — which is the trouble with checking a security property by grepping for
one spelling of it.

Day 013 left the counts at three and four, and Day 014 took them to five and six
by adding the edit and the delete as `"use server"` closures in
`deliverable-list.tsx`. Day 017 added two on the scope tab, and Day 018's
duplicate closure in `overview-panel.tsx` is the eighth. Day 019's pasted
import is the ninth and Day 020's snapshot press is the tenth, both closures in
`scope-panel.tsx`. The counts are only useful if they are updated with the
writes, so: ten captures, eleven references.

Day 019 added a closure without moving the numbers written here, which is the
failure mode that sentence warns about — they were two behind by the time
Day 020 checked them. Nothing was wrong with the code; the note was wrong
about it, which is worse, because the note is what the next run reads.

It is still **not** an ownership check. It establishes which page made the call,
not who was holding it. Phase 8 must derive the project from the session and
must not trust `projectId` however unforgeable it looks.

### What the closures cost

Captured arguments are encrypted with a build-time key, so a page left open
across a deploy that rotated it cannot decrypt `projectId` and the write
rejects. Both paths now degrade to a sentence telling the reader to reload
(`SCOPE_NO_ANSWER`, `ADD_NO_ANSWER`) rather than to an error boundary, which is
also what they do for a dropped connection. Setting a stable
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in deployment would remove the redeploy
case; nothing in the repo sets one today.

## Day 020 ran twice, for the reason Day 013 did

Day 020 — scope diffing: the two snapshot tables, the comparison function, and
the scope tab's snapshot controls — was built on 2026-10-13 in 100 commits
(`919b287..62bb16c`), and pushed: `origin/main` was already at `62bb16c` when
2026-10-15 started. The box in `ROADMAP.md` was never ticked, so the workflow
picked Day 020 again, exactly as it did for Day 013.

So 2026-10-15 audited what was there rather than rebuilding it or padding the
history. `npm run verify` was green on arrival — 94 files, 2006 tests — and the
milestone was complete: table, comparison function, and UI.

## What the Day 020 audit changed

`/code-review` on `1abae20..HEAD` found four things, and a second review of the
audit's own diff found three more in the fixes. The substantive ones:

- **A reorder could never be snapshotted.** The capture refuses a press that
  would record what the last snapshot already says, and it asked `diffScope` —
  which deliberately does not compare position. But a snapshot *does* record
  the order, so reordering three deliverables and pressing the button was
  refused as "nothing has changed", and the agreed order became unrecordable
  after a project's first snapshot. `sameRecordedOrder` asks the question the
  comparison cannot: the ids in sequence, not the stored positions, because
  deleting a line renumbers the ones after it.
- **The estimate sentence did not add up.** Both ends and the movement between
  them were each rounded to hundredths of an hour independently, so 7 minutes
  growing to 14 read "up 0.12 hours, from 0.12 hours to 0.23 hours".
  `estimatedHoursMoved` takes the difference of the two figures the sentence
  prints, which costs up to 36 seconds against the true movement and buys a
  sentence a reader can check. A minute of movement is 0.0167 hours — more
  than two roundings can hide — so it can never come back as "no change".
- **Two cancelled sums read as an estimate that held steady.** With a
  hand-edited negative line on both sides, a delta of zero fell through to
  "The estimate is unchanged, at 0 hours" above a table listing two estimate
  changes — the one reading `describe.ts` exists to prevent. It now says the
  figures hold a line below zero rather than that anything cancelled, because
  a negative total does not cancel out, and the per-side "nothing was
  estimated" sentences are asked first so a coincidence of two unusable
  figures does not pre-empt a fact about one side.
- **A refusal pointed at a comparison it had not made.** "The comparison below
  already covers it" is a claim about the page: the comparison on show is
  whichever snapshot the URL asked for, so a reader who had clicked an older
  one in the picker was told their answer was in a comparison against
  something else, possibly listing a dozen changes. The sentence now says what
  it compared and stops.

The last of those was Day 020's own wording rather than the audit's, which is
the argument for the second review pass: three of the seven findings were in
the fixes, and one of those fixes was wrong in a way the first review could not
have seen.

`/security-review` could not be run as a skill — it diffs against
`origin/HEAD`, and `origin/main` was already at the day's last commit, so its
diff was empty. The pass was done by hand over the day's actual surface: the
press takes its project from an encrypted closure declared in the page, like
every other write on the tab; the label goes through `optionalText` with the
limit the input carries; and `?snapshot=` is resolved against the project's own
list by `chosenSnapshot` before `listSnapshotLines` sees it, so a snapshot id
from a URL cannot read another project's lines. The capture counts above were
checked against a fresh build and are unchanged at ten and eleven.

## Left alone deliberately

- **Day 010's `transitionProjectAction`** is still a bare export of a
  `"use server"` module taking `projectId` as an argument — the same hole, in
  the file next door. Left because it is Day 010's, and noted because the
  reference count above will not come back to four if it is ever fixed.
- **Three client-bound actions**, same class, earlier milestones:
  `app/clients/[id]/edit/client-form.tsx:38`,
  `app/projects/[id]/edit/project-form.tsx:43`,
  `app/projects/[id]/status-form.tsx:50`. Each binds an id with `.bind` in a
  client component, so each id is forgeable. No impact while there is no auth,
  and they belong to Days 004/009/010 rather than this milestone — but Phase 8
  should not land before they are closures too.
- **The `attempt` wrapper costs progressive enhancement**, on the duplicate
  form and on the three that already had it (`add-deliverable-form.tsx`,
  `save-template-form.tsx`, `apply-template-form.tsx`). Wrapping the action in
  a plain client function so a rejected dispatch can be caught means
  `useActionState` has no server reference to put in the markup, so the form
  does not work before hydration. Measured rather than reasoned — the overview
  tab serves both shapes at once:

  ```
  curl -s 'http://localhost:3000/projects/<id>?tab=overview' | grep -o '<form[^>]*>'
  <form ... action="" encType="multipart/form-data" method="POST">        # status
  <form ... action="javascript:throw new Error('React form ...')">        # duplicate
  ```

  The status form passes its action straight through and posts without JS; the
  duplicate form throws in the browser, so an early press is silently lost.
  Left as it is because the wrapper is load-bearing here for a reason the other
  three do not have: `redirect` signals by throwing, Next rejects the dispatch
  promise with it, and without `unstable_rethrow` a *successful* copy would be
  reported to the reader as a failure. `useActionState` offers no way to have
  both, so the choice is a lost press before hydration against a copy that was
  made being announced as one that was not. Worth revisiting for all four
  together, not on the day that added the fourth.

  Day 019's `bulk-import-form.tsx` and Day 020's `take-snapshot-form.tsx` are
  the fifth and sixth. Neither redirects, so neither has the duplicate form's
  excuse — they wrap for the plainer reason that a rejected dispatch would
  otherwise take the page to an error boundary and throw away the paste or the
  label that had just been typed. Six forms is past the point where this is
  worth revisiting one at a time.

- **The snapshot picker has no ceiling and no pagination.** A project
  accumulates snapshots for as long as it runs, `listScopeSnapshots` has no
  `LIMIT`, and `snapshot-picker.tsx` renders one line per row. What bounds it
  is the capture itself: a press is refused when nothing has changed since the
  most recent snapshot, so a held-down button writes one row rather than a
  thousand copies of one, and growth after that needs a real edit to the scope
  list. That makes the two snapshot tables no more unbounded than the
  `deliverables` table they copy — which is an argument for leaving it, not a
  reason the picker will still read well after fifty of them. A limit is the
  cheap fix and it has a cost worth weighing first: `chosenSnapshot` falls back
  to the newest when it cannot find the id it was asked for, so a limit would
  silently redirect a link to a snapshot older than the cut rather than refuse
  it.

- **`npm run lint`** reports seven `no-require-imports` errors in `scripts/*.js`.
  They predate Day 013 and CI runs `npm run verify`, not `npm run lint`, so
  nothing is red because of them.
