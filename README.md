# Keel

An operations system for independent studios and solo consultants, built around
one idea most project tools miss: **scope is a contract, and it leaks.**

## The problem

Freelancers and small studios don't usually lose money on projects they priced
wrong. They lose it on projects they priced correctly and then quietly
over-delivered. The extra revision, the "quick call", the feature that wasn't in
the statement of work — each one is small enough to absorb, and collectively
they turn a profitable engagement into a break-even one. By the time it's
visible in a time report, the money is already spent.

Harvest tracks hours. Notion tracks tasks. Bonsai sends invoices. None of them
watch the gap between *what you contracted to deliver* and *what you are
actually delivering*, and tell you while you can still do something about it.

## The wedge

Every project in Keel carries an explicit scope: deliverables with estimates,
and a contracted value. As time is logged, Keel continuously compares burned
value against contracted value, and completion against estimate. When a project
starts consuming budget faster than it produces deliverables, it gets flagged —
with an explanation of why, and a one-click path to turn the overage into a
change order you can actually send.

The pitch is one sentence: *know a project is going over while you can still
bill for it.*

## Status

Under construction, one increment per day, on the plan in
[`ROADMAP.md`](./ROADMAP.md). Progress is visible in the commit history — the
build is autonomous, so each commit is a single roadmap task.

## Running it

```bash
npm install
cp .env.example .env
npm run db:generate && npm run db:migrate
npm run dev
```

Tests: `npm test`. Production build: `npm run build`.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4, Drizzle ORM over libSQL
(a local SQLite file in development, Turso in production without a driver
change), Vitest.
