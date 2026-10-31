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

## Day 023 ran twice, for the reason Days 013 and 020 did

Day 023 — the time entry list, grouped by day with running totals, with an
editor and a deletion step inside the rows — was built on 2026-10-21 in 49
commits (`99ab53d..cd596cc`), and pushed: `origin/main` was already at
`cd596cc` when 2026-10-22 started. The box in `ROADMAP.md` was never ticked, so
the workflow picked Day 023 again.

So 2026-10-22 audited what was there rather than rebuilding it or padding the
history. `npm run verify` was green on arrival — 109 files, 2533 tests — and
the milestone was complete: the grouping, the day and running totals, the
in-row editor, the deletion step.

## What the Day 023 audit changed

`/code-review` on `99ab53d..HEAD` found three things. A second pass over the
audit's own diff found three more, two of them in the first fix; a third pass
over those fixes found two more, both in the same mechanism. Every pass but the
first was reviewing the audit rather than the day, and every pass but the first
found something — which is the whole argument for running them.

- **An editor could be unmounted with its save in flight.** The day had
  already noticed half of this: the Cancel button is disabled while a save is
  outstanding, and the editor stopped Escape from reaching the list. But
  Escape was only stopped when the key was pressed *inside* the form, and the
  Edit or Delete button on any other row replaced the open editor outright.
  Either way the form went before its answer arrived, so a refusal — a billed
  entry, a dropped line of scope, a connection that died — was set on a
  component that no longer existed. The write went through regardless, leaving
  a row that had silently changed or silently not, and the correction gone. The
  rule now lives on the list, which is the thing that owns the open row, and
  the editor no longer holds a half of it.

- **The hold had to be narrower than "a save is in flight", twice over.** An
  answer can outlive its form: the row leaves the list, `openRowStillThere`
  drops it, and the editor is unmounted with the request still out. Held on
  that, the list spent the rest of the round trip refusing every press with no
  editor anywhere in sight — a page that looks broken, to fix one that merely
  loses a sentence. Narrowing it to "an editor is open" was still too wide: an
  orphaned save then held whichever row the reader had moved on to, refusing
  presses about an edit that was not the one in front of them. The saves are
  counted per row, and the hold asks only about the row that is open.

  A press the hold refuses says so in the live region — both of them, the
  controls on another row and Escape. On screen the Save button reads
  "Saving…" and explains itself; through a screen reader a control that does
  nothing and says nothing is a page that has stopped working, and Escape was
  the one left silent after the first fix.

- **The first attempt at the late-answer cursor guard protected nothing.** A
  row's save is answered by the handler the editor was holding when the press
  was made, so the `open` captured in that closure is the row being edited by
  definition — asking it whether the row is still open is asking a question
  whose answer was written before it could arise. The guard was therefore
  always true, and the cursor steal it was meant to stop was being prevented
  only by the hold above. `openNow` is a ref kept in step by an effect, which
  is the device this file already uses to let a press read the list as it
  stands rather than as it was.

- **An edit refused in the words of the form that logs time.** The editor's
  picker deliberately offers the entry's own attribution when the project's
  scope list no longer holds it, so saving one is a refusal a reader can
  reach — and the sentence beside the picker told them to "log the time
  against the project itself", on a form that logs nothing and whose entry is
  already on the record. `parseLogTimeForm` now takes that sentence from its
  caller. It is the only one of its refusals that needs to: everything else it
  says is true of a duration or a day wherever it was typed, and this one ends
  in an instruction that depends on whether an entry is being written or
  corrected.

`/security-review` could not be run as a skill again, and for a plainer reason
than Day 020's: it diffs against `origin/HEAD`, which this checkout does not
set, so the skill fails before it starts. The pass was done by hand over the
day's surface, and the day's own reasoning held up:

- Both writes are reachable only through the `"use server"` closures declared
  in `time-list.tsx`, which capture the project and the offered scope list
  encrypted. `time-writes.ts` has no module-level `"use server"`, so neither
  function is an endpoint of its own.
- `projectTimeEntry` is the ownership check: the project comes from the
  closure, the entry id from the submission, and an id that is blank, unknown
  or another project's gets the same sentence as the other two — so a POST
  cannot use a page it was legitimately served to edit or delete anything else,
  and cannot learn from the refusal which of the three it was.
- A re-attribution is checked against the list the page rendered rather than a
  fresh read, so an entry cannot be moved onto a deliverable the reader never
  saw; `updateTimeEntry` refuses `no-such-deliverable` behind it.
- A deletion needs the `remove` field that only the confirming button carries,
  so no other press and no form submitted another way can produce one.
- The validation is the log line's: the duration bounded at both ends, the day
  a real calendar date, the note trimmed and capped at 500, the checkbox read
  strictly. Notes reach the page as text children, so a note is escaped by
  JSX rather than by anything this code does.
- What crosses to the client is narrowed: seven columns of an entry and three
  of a deliverable, no timestamps and no project ids, which is also what keeps
  the captured closures small.

As everywhere else, all of this says which page made the call and not who was
holding it. Phase 8 answers the second question from the session.

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

- **A reorder is recordable but not reportable.** The audit made a reordered
  scope list something a snapshot can record; it did not make the comparison
  say so. `diffScope` leaves position out on purpose — a reorder is not a
  change to what was promised, and positions move on their own when a line is
  deleted, so reporting them would fill the table with rows nobody touched.
  The consequence is a snapshot that differs from the live list only in order,
  whose comparison reads "Nothing has changed since this snapshot". That
  sentence names the three things it checked, so it does not lie, but a reader
  who has just reordered the list may expect a fourth. Whether the order is
  worth a row of its own is a question for the day that has a reason to ask
  it, not for an audit.

- **Two snapshots can read identically in the picker.** A line is the label
  and the date, and the label is optional, so taking two unlabelled snapshots
  on one day gives two links reading "Oct 15" with the same size beside them —
  and `snapshotTakenLabel` claims the date is "the thing that cannot be
  ambiguous", which is wrong within a day. Nothing in the app renders a time
  of day, and adding one here is a decision about timezones rather than about
  snapshots: the stored string is UTC, `formatDate` deliberately reads the
  calendar date off the front without converting, and a picker showing 09:36
  for a press made at 11:36 local would be a new kind of wrong. Day 098 sets
  date formats across every view and is the place to decide it.

- **The scope tab's editor can still be unmounted mid-save.** The hold the
  Day 023 audit added lives in `time-rows.tsx`, and `scope-rows.tsx` has the
  same shape of bug in a wider form: `EditDeliverableForm` does not read its
  pending state at all, so Escape closes it and its Cancel button stays live
  while a save is outstanding — and a refused edit to a deliverable is lost the
  same way a refused edit to a time entry was. `lib/rows.ts` argues in its own
  header that these two lists must not diverge about the open row, and this is
  a divergence. Left because closing it means changing Day 013's editor, its
  action plumbing and its Cancel button with no component tests anywhere in the
  repo to catch a regression, which is a day's work on another day's milestone
  rather than an audit's. The fix, when it is taken: the counted save and
  `holdsOpenRow` move next to `lib/rows.ts`, and both lists route their edit
  through it.

- **`npm run lint`** reports seven `no-require-imports` errors in `scripts/*.js`.
  They predate Day 013 and CI runs `npm run verify`, not `npm run lint`, so
  nothing is red because of them.

## What Phase 6 owes the billed-time guard

Day 021 gave `time_entries` a `billedInvoiceId` and two guards in front of it:
`updateTimeEntry` refuses to move anything an invoice copied a figure out of,
and `deleteTimeEntry` refuses to remove billed time at all. Two foreign keys
outrank both, and the day left them that way on purpose. Both are pinned by
tests in `lib/data/time-entries.test.ts` so neither is a surprise later.

- **Deleting a deliverable nulls a billed entry's attribution.** The column is
  `ON DELETE SET NULL`, which is the right rule for the ordinary case: the
  hours were worked and still count against the project, so dropping a line of
  scope must not quietly reduce what the engagement cost. The consequence is
  that an entry billed under "Discovery" can end up attributed to nothing,
  which is exactly the change `editRefusedByInvoice` refuses one row at a time.
  Refusing it in the cascade too would mean a line of scope can never be
  dropped once any of its time is billed — a worse rule, and the reason this is
  recorded rather than fixed. Phase 6 copies what it bills into
  `invoice_line_items`, so no document changes when this happens; what is lost
  is the entry agreeing with the invoice it was billed on.

- **Deleting a project removes its billed time outright.** `projects` cascades,
  so `deleteProject` takes every entry with it, billed or not. The guard that
  belongs here is not in this table: an issued invoice is the thing that should
  stop a project being deleted, and there are no invoices yet. Day 056 adds
  them, and the project delete is where to put the refusal — a project with an
  issued invoice is a record somebody has sent and may have been paid for.

Neither cascade bumps `updatedAt` on the rows it touches, which SQLite cannot
do. An entry whose attribution was cleared this way looks untouched since the
day it was logged.

## The encrypted-capture counts, corrected at Day 025

The check in "How the project id stopped being forgeable" was last written down
with **ten** captures and **eleven** references. Both were stale before this
day started. Days 022 and 023 added three closures to the time tab — the log
line, and the editor and deletion inside the rows — without touching the
sentence that says the counts are only useful if they move with the writes.

Day 025 adds three more: `start`, `stop` and `discard`, declared in
`timer-section.tsx`. Measured against a fresh build:

```
rm -rf .next && npm run build
grep -rho 'encryptActionBoundArgs)("[0-9a-f]*"' .next/server/chunks/ssr/*.js | wc -l   # 16
python3 -c "import json;m=json.load(open('.next/server/server-reference-manifest.json'));print(len([k for k,v in m['node'].items() if 'app/projects/[id]/page' in v['workers']]))"   # 17
```

Sixteen captures and seventeen references — the sixteen closures plus Day 010's
`transitionProjectAction`, which is still a bare export. The gap between the
two numbers is the thing to watch rather than either number on its own: it is
one, and a second bare export would make it two.

`timer-writes.ts` has no `"use server"` of its own, for the reason
`scope-writes.ts` and `time-writes.ts` do not. It still establishes which page
made the call and not who was holding it: a running timer is global today,
because there is one person using the app, and Phase 8 has to scope it by owner
at the same time as it scopes everything else. The `slot` column is where that
goes — one timer per user, by the index that today enforces one in total.

## Day 025 ran twice, for the reason Days 013 and 020 did

Day 025 — the running clock: the `active_timers` row, the three presses, and
the panel on the time tab — was built on 2026-10-28 in 67 commits
(`e03027d..772731d`), and pushed: `origin/main` was already at `772731d` when
2026-10-29 started. The box in `ROADMAP.md` was never ticked, so the workflow
picked Day 025 again.

So 2026-10-29 audited what was there rather than rebuilding it or padding the
history. `npm run verify` was green on arrival — 119 files, 2854 tests — and the
milestone was complete: the table and its migration, the data layer, the pure
arithmetic, the three writes, and a panel that survives a reload because the
clock is a row. `/security-review` over the same range found nothing: the
project id is captured encrypted, `projectTimer` requires the press to name
both the clock and the project, and `slot` is not reachable from any caller.

## What the Day 025 audit changed

Every finding was about what happens *after* a press, which is the part of this
panel that nothing renders: where the cursor goes, and which sentence is on
screen.

- **Keeping a clock dropped the cursor to the document.** "Keep it running"
  called `.focus()` on the Discard button, which is disabled while the step it
  opens is open — so the press did nothing and the browser dropped the focus
  when the step unmounted. It goes through the note the effect reads, which is
  acted on in the render that enables the button again.
- **Starting a clock dropped it too.** The panel replaces the form and takes
  the Start button with it, which is the mirror of what stopping does, and that
  direction was simply not handled. The refusal that says a clock is *already*
  running does the same thing — it revalidates, so the form goes — and that is
  why `startReplacedForm` is asked rather than `started !== null`.
- **"A clock is already running on X" came back after the clock was stopped.**
  It was a `formError`, so it belonged to the form, and the form is gone until
  the reader stops the clock the sentence is about — at which point it returned,
  `role="alert"` and all, saying a clock was running moments after they had
  stopped it. It is a `refusal` now: carried beside the panel, where it can be
  read with the clock it is about, and cleared by the next press like every
  other complaint on this panel.
- **A focus note had no expiry.** It was held until its control appeared, with
  nothing to say it never would: a clock stopped here while another was started
  on a phone left the note for the Start button unredeemed until that clock
  stopped too, pulling the cursor out of whatever had been typed since. A note
  now carries the clock it was left under and is dropped once that has moved on.
- **Two effects set state on render.** They were the two pieces of state that
  were really derivations — whether the discard step is open, and what the live
  region says about a started clock. The step holds the clock id it is asking
  about, and the start says its own sentence from the press that got the answer,
  like the stop and the discard beside it.
- `stopActiveTimer`'s doc claimed its `now` parameter made the stored figure the
  figure the reader had been shown. It does not: the action reads the server's
  clock and the panel counts on the browser's, so a skewed machine differs by a
  minute. What the parameter buys is one instant per press.

### `npm run lint` is not in `verify`, and it matters

The two set-state-in-effect errors were `react-hooks` **errors**, not warnings,
and they shipped because `npm run verify` is `build && test` — eslint runs in
neither. `npm run lint` cannot simply be added: `scripts/*.js` have had
`@typescript-eslint/no-require-imports` errors since before this phase, so the
command exits non-zero on a clean tree and would fail every day.

Until those are fixed, a day that writes a client component should run

```
npx eslint app components lib
```

which is clean as of today apart from three unused-variable warnings in test
files. It is the only check that sees a React rule being broken.

## Day 026 ran twice, for the reason Days 013, 020 and 025 did

Day 026 — the weekly timesheet at `/time`: the week arithmetic, the grid
assembly, the keyboard cursor and the page — was built on 2026-10-30 in 84
commits (`bd9e95f..bcb72c1`), and pushed: `origin/main` was already at
`bcb72c1` when 2026-10-31 started. The box in `ROADMAP.md` was never ticked,
so the workflow picked Day 026 again.

So 2026-10-31 audited what was there. `npm run verify` was green on arrival —
124 files, 3096 tests — and the milestone was complete: a seven-column grid by
project with totals in both directions, a cursor the arrows move, the week in
the URL, and two different empty states. `/security-review` over the range
found nothing, and the reasoning is worth keeping: the range is read-only,
adds no server action, and the only user-controlled value is the `week` param,
which is gated twice — `hasWeek` before `weekOf`, then the data layer's own
`calendarDate` guard before Drizzle's bound `gte`/`lte`.

The audit also did what no test in this repo can: it ran the built app against
a seeded throwaway database and read `/time` back. That is how the year-zero
heading below was found, and it is the only check that executes the page at
all — `/time` is `force-dynamic`, so `next build` never renders it.

## What the Day 026 audit changed

**The grid was not announced as one.** The table implemented the ARIA grid
pattern — one tab stop, the arrows moving between cells — without saying it
was a grid. A screen reader reads a plain `<table>` in browse mode, where it
owns the arrow keys for its own cursor, so the keypress never reached a cell's
`onKeyDown`: the whole point of the day worked for a mouse and for Tab and
silently not for the reader who needs it. `role="grid"` is the fix, and the
markup underneath needed nothing — a `<td>` inside a table exposed as a grid
is already a `gridcell`. `aria-readonly` went on with it, and comes off on
Day 027.

The hint above the grid then had to say *which* cells the arrows cross. The
totals along the two edges carry no tab index, deliberately — nothing can be
done to a figure derived from the cells beside it — but once the table claims
to be a widget, a reader arrowing right off Sunday expecting the week's total
needs telling why nothing happened.

**`calendarDateParts` lost the leading zeros of a year.** Pulling the pieces
out of `formatDate` turned the year from the string the regex matched into a
number, and a number has no leading zeros: `0099` formatted as `99`, which is
a different year, and `0000` as `0`, which is not one. The week heading at the
early end of the calendar read `Jan 10 – 16, 0`. The parts stay numbers
because `describeWeek` compares two of them to decide whether to print one
year or two; `formatYear` pads at the point of writing.

**Two guards were incomplete in the same `<th>`.** `weekdayHeading` promised
to hand back anything it could not read and tested that with
`calendarDateParts`, which reads the date off the front of a timestamp and
accepts `2026-02-30`; both then reached `weekdayName` and threw. Completing it
achieved nothing on its own, because the column asks `isWeekend` about the
same value in the same heading and that still threw on exactly those shapes.
The lesson is the one the fix encodes: a fallback is only a fallback if
everything reading the value falls back together.

**A quadrillion-day shift came back as a string.** `shiftCalendarDate`'s range
guard asked whether the year was below zero or above 9999. Past the days a
`Date` can hold every reading of it is `NaN`, which is neither, so the guard
passed and the function returned `0NaN-NaN-NaN` — a value every later
`isCalendarDate` rejects somewhere with no sign of where it came from. Asked
as one claim the year has to satisfy instead.

**The week summary disagreed with the grid about zero.** Every other figure on
the sheet decides "is there work here" by the entry count, and `minutesFigure`
documents why: the count and the minutes cannot differ today, and resting on
the count means they still cannot if that changes. `describeTimesheet` was the
one place that asked the minutes, so a cell the reader could see could sit
under a line saying nothing was logged.

**`/time` was not on the page that indexes the routes.** Reachable from the
projects list and from a project's time tab, and from nowhere a reader
arriving at the site would look.

### Left alone deliberately

The cursor crosses the day cells and not the totals or the row headers. The
strict grid pattern would have every cell in the arrow path, and a spreadsheet
reader would expect ArrowRight off Sunday to land on the week's total. Both
are true, and extending the cursor to an eighth column and a footer row is a
redesign of `sheetSize`, `startingCursor`, `cellDomId` and `TotalCell` — on
the day Day 027 is about to put an editor in exactly the seven cells that are
in the path. It is Day 027's decision to make with the editor in hand, not an
audit's to make without one. The hint says what the arrows do instead.

The cell sentences are verbose: crossing a row announces the project and the
client seven times, because each cell carries its own position as its
accessible name. Under `role="grid"` a screen reader announces the row and
column headers itself when the cursor moves, which makes most of that
redundant — but how reliably it does so varies by reader and by mode, and
trading a sentence that is certainly complete for one that depends on the
headers being announced is not a trade to make blind. Worth revisiting the
first time this is heard on a real screen reader.
