# Roadmap

100 milestones, one per day. The daily workflow picks the **first unchecked
box** — not today's date — so a failed day is retried tomorrow rather than
skipped, and the sequence never loses a task.

Each milestone is deliberately larger than one commit. A day's work is
decomposed into roughly **20 atomic commits**, each one a complete unit of
work that builds and passes tests on its own. See `CLAUDE.md` for what counts
as an atomic commit and what does not.

## Phase 1 — Clients and projects (1–10)

- [x] **Day 001** — Client data layer in `lib/data/clients.ts`: create, get, list (excluding archived), update, archive. Generate ids with a small `lib/id.ts` helper. Cover every function with tests against an in-memory libSQL database.
- [x] **Day 002** — Clients list page at `/clients`: server component reading the data layer, rendering a table of name, company, default rate, and created date. Include an empty state.
- [x] **Day 003** — New client form at `/clients/new` backed by a server action: field-level validation, `parseCents` for the rate, inline error rendering, redirect on success, and tests for every validation branch.
- [ ] **Day 004** — Client edit page and soft-delete archive action, with an unarchive path and tests proving archived clients leave the list without leaving the table.
- [ ] **Day 005** — Shared form primitives in `components/form/`: labelled input, field error, submit button with pending state, and a `useFormStatus` wrapper. Retrofit the client forms onto them.
- [ ] **Day 006** — `projects` table and data layer: clientId, name, status (`draft`/`active`/`paused`/`closed`), contractValueCents, rateCents override, startedAt, closedAt. Full CRUD with tests.
- [ ] **Day 007** — Projects list at `/projects` with the client name joined in, status filter, and a sortable created/updated column.
- [ ] **Day 008** — Project detail shell at `/projects/[id]`: header with client link, status badge, contract value, and a tabbed layout the later phases fill in.
- [ ] **Day 009** — New and edit project forms with a client picker, contract value input, and optional rate override, sharing the Day 005 primitives.
- [ ] **Day 010** — Project status transitions with guards (a closed project cannot silently reopen), an audit trail table, and tests for every legal and illegal transition.

## Phase 2 — Scope as a contract (11–20)

- [ ] **Day 011** — `deliverables` table and data layer: projectId, title, description, estimatedMinutes, status, sortOrder. CRUD plus reordering, with tests.
- [ ] **Day 012** — Deliverables section on the project page: ordered list, inline add, and an empty state that explains why scope matters.
- [ ] **Day 013** — Deliverable status toggling and drag-free reordering (move up/down server actions), with optimistic UI.
- [ ] **Day 014** — Deliverable edit and delete, with a confirmation flow that does not rely on `window.confirm`.
- [ ] **Day 015** — `lib/scope.ts`: estimated hours, implied effective rate, and remaining estimate from deliverables plus contract value. Pure functions, exhaustively tested including zero and negative cases.
- [ ] **Day 016** — Scope summary panel on the project page rendering the Day 015 numbers with plain-language labels.
- [ ] **Day 017** — Deliverable templates: save a set of deliverables from a project, apply them to a new one. Table, data layer, and UI.
- [ ] **Day 018** — Project duplication, carrying deliverables and rates but not time or invoices, with tests asserting exactly what is and is not copied.
- [ ] **Day 019** — Bulk deliverable import from pasted text, one per line, with a preview step before committing.
- [ ] **Day 020** — Scope diffing: snapshot a project's scope at a point in time and show what changed since. Table, comparison function, and UI.

## Phase 3 — Time (21–30)

- [ ] **Day 021** — `time_entries` table and data layer: projectId, deliverableId, minutes, note, workedOn, billable, billedInvoiceId. Full CRUD with tests.
- [ ] **Day 022** — Log-time form on the project page, optionally attributed to a deliverable, accepting `1h30m` and `90` alike via a tested duration parser.
- [ ] **Day 023** — Time entry list with edit and delete, grouped by day, with running daily totals.
- [ ] **Day 024** — Time rollups per deliverable and per project, shown against the Day 015 estimates.
- [ ] **Day 025** — A running timer: start, stop, and a persisted active-timer row so a reload does not lose it.
- [ ] **Day 026** — Weekly timesheet view at `/time`, a seven-column grid by project, with keyboard-navigable cells.
- [ ] **Day 027** — Bulk time entry from the timesheet grid, writing many entries in one transaction.
- [ ] **Day 028** — Time filtering by date range, project, client, and billable flag, driven entirely by URL search params.
- [ ] **Day 029** — CSV export of filtered time entries, generated server-side with correct escaping and a tested formatter.
- [ ] **Day 030** — Idle-time correction: flag entries that look implausible (over 12h, overlapping, negative) and offer a fix, with the detection logic pure and tested.

## Phase 4 — The wedge: scope creep detection (31–45)

- [ ] **Day 031** — `lib/rates.ts`: resolve a project's effective rate (override, else client default, else zero) and convert minutes to burned cents. Pure and tested.
- [ ] **Day 032** — Burn summary on the project page: contracted, burned, remaining, and percentage consumed.
- [ ] **Day 033** — `lib/scope-creep.ts`: classify a project `healthy` / `watch` / `over` from burn versus contract and completion versus estimate, including the case that matters most — high burn with low completion. Pure, exhaustively tested.
- [ ] **Day 034** — Scope health banner on the project page explaining *why* a project is flagged, in a sentence, not a coloured dot.
- [ ] **Day 035** — Burn-down over time: a stored daily snapshot of burned value per project, plus a backfill for existing data.
- [ ] **Day 036** — Burn-down chart on the project page, rendered server-side as inline SVG with no client charting library.
- [ ] **Day 037** — Projected completion: extrapolate from the burn rate to an expected overage, with confidence caveats surfaced honestly in the UI.
- [ ] **Day 038** — Configurable thresholds per client and per project, falling back to sensible defaults, with the resolution logic tested.
- [ ] **Day 039** — A portfolio view at `/health` ranking every active project by scope risk.
- [ ] **Day 040** — Alerting rules: persist which projects have already been flagged so the same warning is not repeated every day.
- [ ] **Day 041** — Weekly digest generation: a pure function producing a summary of at-risk projects, tested against fixtures.
- [ ] **Day 042** — Digest rendering as both HTML and plain text, with a preview route.
- [ ] **Day 043** — Scope creep attribution: which deliverables consumed the overage, ranked.
- [ ] **Day 044** — "What would it take" calculator: the rate or scope change that would bring a flagged project back to healthy.
- [ ] **Day 045** — Historical accuracy report: how well past estimates predicted actual time, per client.

## Phase 5 — Change orders (46–55)

- [ ] **Day 046** — `change_orders` table and data layer: projectId, title, description, amountCents, status, sentAt, decidedAt. CRUD with tests.
- [ ] **Day 047** — Create a change order pre-filled from a flagged project's overage amount.
- [ ] **Day 048** — Change order detail page with status transitions and guards against illegal moves.
- [ ] **Day 049** — Accepted change orders raise a project's effective contract value; every burn calculation must account for them. Update Day 031–033 and their tests.
- [ ] **Day 050** — Change order list at `/change-orders` with status filtering and totals.
- [ ] **Day 051** — Printable change order document with a clean print stylesheet.
- [ ] **Day 052** — Change order templates and reusable clause snippets.
- [ ] **Day 053** — Decline reasons and a follow-up prompt, captured as structured data rather than free text alone.
- [ ] **Day 054** — Change order acceptance rate metrics per client.
- [ ] **Day 055** — Link change orders to the specific deliverables they add, and reflect those in scope calculations.

## Phase 6 — Invoicing (56–70)

- [ ] **Day 056** — `invoices` and `invoice_line_items` tables and data layers, with sequential per-year invoice numbering that is tested for gaps and races.
- [ ] **Day 057** — `lib/invoicing.ts`: build a draft invoice from unbilled billable time plus accepted change orders, grouped by deliverable. Pure and tested.
- [ ] **Day 058** — Invoice creation flow from a project, with a preview before committing.
- [ ] **Day 059** — Invoice detail page rendering line items, subtotals, and totals.
- [ ] **Day 060** — Manual line item editing: add, edit, reorder, remove, with totals recomputed server-side.
- [ ] **Day 061** — Invoice status transitions with guards, marking underlying time entries billed on send.
- [ ] **Day 062** — Tax and discount lines, modelled as first-class line item types rather than magic numbers.
- [ ] **Day 063** — Print-quality invoice stylesheet and a dedicated print route.
- [ ] **Day 064** — Invoice list at `/invoices` with status filter, overdue highlighting, and outstanding totals.
- [ ] **Day 065** — Payment recording: partial payments, a payments table, and a tested balance calculation.
- [ ] **Day 066** — Ageing report bucketing receivables by days outstanding.
- [ ] **Day 067** — Recurring invoice schedules for retainer clients.
- [ ] **Day 068** — Credit notes against issued invoices, with balance effects tested.
- [ ] **Day 069** — Invoice CSV and JSON export for handing to an accountant.
- [ ] **Day 070** — Revenue recognition view: billed versus collected versus outstanding, per month.

## Phase 7 — Dashboard and reporting (71–80)

- [ ] **Day 071** — Dashboard at `/`: active projects, flagged projects, unbilled value, outstanding invoices.
- [ ] **Day 072** — Client detail page: their projects, lifetime billed value, and scope health across engagements.
- [ ] **Day 073** — Utilisation report: billable versus non-billable minutes per week.
- [ ] **Day 074** — Effective hourly rate by client and by project, surfacing which work actually pays.
- [ ] **Day 075** — Pipeline view of draft and paused projects with expected value.
- [ ] **Day 076** — Month-over-month trend rendering, server-side SVG, no client charting library.
- [ ] **Day 077** — Global search across clients, projects, deliverables, and invoices, with ranked results.
- [ ] **Day 078** — Saved views: persist a filter set and name it.
- [ ] **Day 079** — Keyboard command palette for navigation and common actions.
- [ ] **Day 080** — Dashboard customisation: choose which panels appear and in what order.

## Phase 8 — Accounts and access (81–88)

- [ ] **Day 081** — `users` and `sessions` tables, password hashing, and a tested session lifecycle.
- [ ] **Day 082** — Sign-up, sign-in, and sign-out flows with server actions and rate limiting.
- [ ] **Day 083** — Route protection via middleware, with tests covering authenticated and anonymous access to every route group.
- [ ] **Day 084** — Scope every existing query by owner, and prove with tests that one user cannot read another's rows.
- [ ] **Day 085** — Account settings: profile, default currency, default rate.
- [ ] **Day 086** — Password reset flow with single-use, expiring tokens.
- [ ] **Day 087** — Audit log of significant actions, queryable per user.
- [ ] **Day 088** — Data export of everything a user owns, as a single JSON download.

## Phase 9 — Quality (89–95)

- [ ] **Day 089** — Accessibility pass: keyboard traversal, focus management, labelled controls, and tests asserting the invariants.
- [ ] **Day 090** — Loading and error states for every route, including error boundaries and `loading.tsx`.
- [ ] **Day 091** — Empty states throughout, each explaining the next useful action.
- [ ] **Day 092** — Performance pass: query counts, N+1 elimination, and indexes on every foreign key and filtered column.
- [ ] **Day 093** — Input validation hardening on every server action, with tests for malformed and hostile input.
- [ ] **Day 094** — Error handling and logging: structured errors, no swallowed exceptions, and a tested error taxonomy.
- [ ] **Day 095** — Test coverage audit: identify untested branches in `lib/` and close the gaps.

## Phase 10 — Product readiness (96–100)

- [ ] **Day 096** — Seed script generating a realistic demo studio, including a clearly over-scope project.
- [ ] **Day 097** — Onboarding flow for a brand new account, from empty to first project.
- [ ] **Day 098** — Settings for currency, date format, and week start, applied consistently across every view.
- [ ] **Day 099** — `docs/TOUR.md` walking the product feature by feature, plus a refreshed README.
- [ ] **Day 100** — Release preparation: changelog assembled from the history, known limitations stated honestly, and a written list of what to build next.
