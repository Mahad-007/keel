import { writeFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { it } from "vitest";

import { burnDownReadings } from "@/lib/burndown/reading";
import { shiftCalendarDate } from "@/lib/dates";

import { BurnDownPanel } from "@/app/projects/[id]/burn-down-panel";

function readings(
  spec: readonly [string, number, number, string][],
) {
  return burnDownReadings(
    spec.map(([onDate, contract, burned, origin]) => ({
      onDate,
      contractValueCents: contract,
      rateCents: 12_000,
      rateSource: "project" as const,
      entryCount: 3,
      loggedMinutes: Math.round((burned / 12_000) * 60),
      billableMinutes: Math.round((burned / 12_000) * 60),
      burnedCents: burned,
      chargeableCents: burned,
      origin,
    })),
  );
}

const STYLE = `
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 32px;
         background: #fff; color: #171717; }
  .page { max-width: 848px; margin: 0 auto; }
  :root { --chart-surface:#ffffff; --chart-line:#2a78d6; --chart-over:#d03b3b;
          --chart-grid:#e4e4e7; --chart-band:#f4f4f5; }
  .dark { --chart-surface:#0a0a0a; --chart-line:#3987e5; --chart-over:#d03b3b;
          --chart-grid:#27272a; --chart-band:#18181b;
          background:#0a0a0a; color:#ededed; }
  .fill-zinc-500 { fill: #71717a; } .fill-zinc-900 { fill: #18181b; }
  .dark .fill-zinc-500, .dark .dark\\:fill-zinc-400 { fill: #a1a1aa; }
  .dark .fill-zinc-900, .dark .dark\\:fill-zinc-100 { fill: #f4f4f5; }
  .tabular-nums { font-variant-numeric: tabular-nums; }
  .mt-4 { margin-top: 16px; } .mt-2 { margin-top: 8px; } .mt-10 { margin-top: 40px; }
  .w-full { width: 100%; }
  section { border-top: 1px solid #e4e4e7; padding-top: 24px; }
  .dark section { border-color: #27272a; }
  h3 { font-size: 14px; margin: 0 0 0; }
  p { font-size: 14px; line-height: 24px; color: #71717a; max-width: 65ch; }
  .dark p { color: #a1a1aa; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 24px 8px 0; text-align: left; }
  thead tr { border-bottom: 1px solid #e4e4e7; font-size: 12px;
             text-transform: uppercase; letter-spacing: .05em; color: #71717a; }
  tbody tr { border-bottom: 1px solid #f4f4f5; }
  .text-right, th.text-right, td.text-right { text-align: right; }
  summary { color: #71717a; font-size: 14px; cursor: pointer; }
  [class*="sr-only"] { position: absolute; width: 1px; height: 1px;
                       overflow: hidden; clip: rect(0 0 0 0); }
`;

const CASES: Record<string, ReturnType<typeof readings>> = {
  "A six-month engagement, two-thirds gone": readings(
    Array.from({ length: 40 }, (_, at) => [
      shiftCalendarDate("2026-03-02", at * 4),
      500_000,
      Math.round(8_000 * at),
      at < 10 ? "backfilled" : "recorded",
    ]),
  ),
  "An engagement that blew through its price": readings(
    Array.from({ length: 24 }, (_, at) => [
      shiftCalendarDate("2026-06-01", at * 5),
      500_000,
      Math.round(26_000 * at),
      "recorded",
    ]),
  ),
  "A big contract, barely started": readings(
    Array.from({ length: 6 }, (_, at) => [
      shiftCalendarDate("2026-09-01", at * 3),
      12_000_000,
      Math.round(96_000 * at),
      "recorded",
    ]),
  ),
  "Two readings, a month apart": readings([
    ["2026-03-01", 500_000, 24_000, "recorded"],
    ["2026-04-01", 500_000, 180_000, "recorded"],
  ]),
  "One reading only": readings([["2026-03-01", 500_000, 60_000, "recorded"]]),
  "Entirely reconstructed, and stale": readings([
    ["2026-01-05", 420_000, 36_000, "backfilled"],
    ["2026-01-19", 420_000, 150_000, "backfilled"],
    ["2026-02-02", 420_000, 290_000, "backfilled"],
  ]),
};

it("writes a preview of the burn-down panel", () => {
  const sections = Object.entries(CASES)
    .map(
      ([title, rows]) =>
        `<h2 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;margin-top:48px">${title}</h2>` +
        renderToStaticMarkup(
          BurnDownPanel({ projectId: "prj_x", readings: rows, today: "2026-11-21" }),
        ),
    )
    .join("\n");

  for (const mode of ["light", "dark"]) {
    writeFileSync(
      `/tmp/burnviz/${mode}.html`,
      `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>` +
        `<body class="${mode === "dark" ? "dark" : ""}"><div class="page">${sections}</div></body>`,
    );
  }
});
