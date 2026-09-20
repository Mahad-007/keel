# Roadmap

One task per day, each small enough to finish, test, and ship in a single
unattended run. The daily workflow picks the **first unchecked box** — not
today's date — so a failed day is retried tomorrow rather than skipped.

Each task should land with tests where there is logic to test, and must leave
`npm run build` and `npm test` passing.

## Phase 1 — Clients and projects

- [x] **Day 01** — Client data layer in `lib/data/clients.ts`: create, get, list (excluding archived), update, archive. Generate ids with a small `lib/id.ts` helper. Cover every function with tests against an in-memory libSQL database.
- [ ] **Day 02** — Clients list page at `/clients`: server component reading the data layer, rendering a table of name, company, default rate, and created date. Include an empty state.
- [ ] **Day 03** — New client form at `/clients/new` backed by a server action, with validation (name required, email shape, rate parsed via `parseCents`) and errors rendered inline.
- [ ] **Day 04** — Client edit page and archive action. Archiving is a soft delete and must drop the client from the list without removing the row.
- [ ] **Day 05** — `projects` table: id, clientId, name, status (`draft`/`active`/`paused`/`closed`), contractValueCents, rateCents (nullable, falls back to the client's default), startedAt, closedAt. Data layer plus tests.
- [ ] **Day 06** — Projects list at `/projects` with the client name joined in, and a project detail shell at `/projects/[id]`.
- [ ] **Day 07** — New project form with a client picker, contract value input, and optional rate override.

## Phase 2 — Scope as a contract

- [ ] **Day 08** — `deliverables` table: id, projectId, title, description, estimatedMinutes, status (`pending`/`in_progress`/`done`), sortOrder. Data layer plus tests.
- [ ] **Day 09** — Deliverables section on the project detail page: list them in sort order, add one inline.
- [ ] **Day 10** — Toggle deliverable status, reorder, and a progress bar showing done versus total.
- [ ] **Day 11** — `lib/scope.ts`: given a project's deliverables and contract value, compute estimated hours, implied effective rate, and remaining estimate. Pure functions, thoroughly tested.
- [ ] **Day 12** — `time_entries` table: id, projectId, deliverableId (nullable), minutes, note, workedOn (date), billable (boolean). Data layer plus tests.
- [ ] **Day 13** — Log-time form on the project page, optionally attributed to a deliverable.
- [ ] **Day 14** — Time rollups: minutes per deliverable and per project, shown alongside the estimates from Day 11.

## Phase 3 — The wedge: scope creep detection

- [ ] **Day 15** — `lib/rates.ts`: resolve the effective rate for a project (project override, else client default), and convert logged minutes into burned cents.
- [ ] **Day 16** — Burn summary on the project page: contracted value, burned value, remaining value, percentage consumed.
- [ ] **Day 17** — `lib/scope-creep.ts`: classify a project as `healthy`, `watch`, `over` given burn versus contract and completion versus estimate. Include the case that matters most — high burn with low completion. Pure, heavily tested.
- [ ] **Day 18** — Surface that classification on the project page as a clear banner explaining *why* a project is flagged, not just that it is.
- [ ] **Day 19** — `change_orders` table: id, projectId, title, description, amountCents, status (`draft`/`sent`/`accepted`/`declined`). Data layer plus tests.
- [ ] **Day 20** — Create a change order pre-filled from the over-scope amount on a flagged project. Accepted change orders raise the project's effective contract value.

## Phase 4 — Getting paid

- [ ] **Day 21** — `invoices` and `invoice_line_items` tables: invoice has number, projectId, status (`draft`/`sent`/`paid`/`void`), issuedOn, dueOn; line items have description, quantity, unitCents. Data layer plus tests.
- [ ] **Day 22** — `lib/invoicing.ts`: build a draft invoice from unbilled billable time plus accepted change orders, grouping time by deliverable. Pure and tested.
- [ ] **Day 23** — Invoice detail page rendering line items and totals, with a print-friendly stylesheet.
- [ ] **Day 24** — Invoice status transitions, guarded so a paid invoice cannot silently return to draft. Mark the underlying time entries billed when an invoice is sent.

## Phase 5 — Making it a product

- [ ] **Day 25** — Dashboard at `/`: active projects, projects flagged by the Day 17 classifier, unbilled value, and outstanding invoice total.
- [ ] **Day 26** — Client detail page: their projects, lifetime billed value, and scope health across all engagements.
- [ ] **Day 27** — Search and filtering across clients and projects, driven by URL search params so results are linkable.
- [ ] **Day 28** — `scripts/seed.ts` generating a realistic demo studio — several clients, projects at different burn levels, including one clearly over scope.
- [ ] **Day 29** — Polish pass: empty states, loading skeletons, an error boundary, and consistent page headers.
- [ ] **Day 30** — Write `docs/TOUR.md` walking through the product feature by feature, refresh the README, and summarise what the 30 days produced and what the obvious next steps are.
