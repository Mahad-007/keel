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
grep -rho 'encryptActionBoundArgs)("[0-9a-f]*",[a-z]*)' .next/server/chunks/ssr/*.js | wc -l   # 3
python3 -c "import json;m=json.load(open('.next/server/server-reference-manifest.json'));print(len([k for k,v in m['node'].items() if 'app/projects/[id]/page' in v['workers']]))"
```

Three encrypted captures, and references for the project page down from seven to
four — the three closures plus Day 010's `transitionProjectAction`, which is
still a bare export. If either number moves, the check has stopped being one.

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
- **`npm run lint`** reports seven `no-require-imports` errors in `scripts/*.js`.
  They predate Day 013 and CI runs `npm run verify`, not `npm run lint`, so
  nothing is red because of them.
