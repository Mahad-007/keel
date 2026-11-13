import { beforeEach, describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { createClient } from "@/lib/data/clients";
import { createProject, getProjectWithClient } from "@/lib/data/projects";
import { createTimeEntry, projectTimeTotals } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { resolveJoinedRate } from "@/lib/rates";

import { burnFigures, burnProblems } from "./burn-summary";
import type { PanelFigure } from "./figure";

/**
 * The burn summary over rows a database actually holds.
 *
 * `burn.test.ts` says what the arithmetic comes to given three numbers and
 * `burn-summary.test.ts` says what each figure reads like given a summary.
 * What neither covers is the join the panel makes: a rate resolved off a row
 * read through the data layer, minutes totalled in SQL, and a contract value
 * off the project — turned into the four lines a reader sees.
 *
 * That is exactly what a renamed column, a changed default or a dropped join
 * breaks silently, because every unit test on either side of it still passes.
 * The expensive version of that failure is a project inheriting its client's
 * rate: the override is NULL, the join forgets to carry the default, and every
 * figure on the panel reads nought with nothing on screen saying why.
 */

let db: Database;
/** A client who bills at $180/hr by default. */
let clientId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient(
    { name: "Harbour Co", defaultRateCents: 18_000 },
    db,
  );
  clientId = client.id;
});

/** The burn as the panel would receive it, from the page's two reads. */
async function summaryFor(projectId: string): Promise<BurnSummary> {
  const [project, totals] = await Promise.all([
    getProjectWithClient(projectId, db),
    projectTimeTotals(projectId, db),
  ]);
  if (project === null) throw new Error("no such project");
  return summariseBurn(
    totals,
    project.contractValueCents,
    resolveJoinedRate(project),
  );
}

/** The figures the panel would draw from it. */
async function figures(projectId: string): Promise<PanelFigure[]> {
  return burnFigures(await summaryFor(projectId));
}

/** The value of one figure by its label, so a test names what it reads. */
function valueOf(drawn: readonly PanelFigure[], label: string): string {
  const figure = drawn.find((row) => row.label === label);
  if (figure === undefined) throw new Error(`no ${label} figure`);
  return figure.value;
}

describe("the burn panel over real rows", () => {
  it("values hours at the client's default when the project inherits it", async () => {
    const project = await createProject(
      { clientId, name: "Site rebuild", contractValueCents: 500_000 },
      db,
    );
    await createTimeEntry(
      { projectId: project.id, minutes: 600, workedOn: "2026-11-02" },
      db,
    );

    const drawn = await figures(project.id);

    expect(valueOf(drawn, "Contracted")).toBe("$5,000.00");
    expect(valueOf(drawn, "Burned")).toBe("$1,800.00");
    expect(valueOf(drawn, "Remaining")).toBe("$3,200.00");
    expect(valueOf(drawn, "Consumed")).toBe("36%");
  });

  it("values them at the project's override when it has one", async () => {
    const project = await createProject(
      {
        clientId,
        name: "Rush job",
        contractValueCents: 500_000,
        rateCents: 25_000,
      },
      db,
    );
    await createTimeEntry(
      { projectId: project.id, minutes: 600, workedOn: "2026-11-02" },
      db,
    );

    expect(valueOf(await figures(project.id), "Burned")).toBe("$2,500.00");
  });

  it("adds up entries across days and keeps write-offs in the burn", async () => {
    const project = await createProject(
      { clientId, name: "Long haul", contractValueCents: 500_000 },
      db,
    );
    await createTimeEntry(
      { projectId: project.id, minutes: 300, workedOn: "2026-11-02" },
      db,
    );
    await createTimeEntry(
      {
        projectId: project.id,
        minutes: 300,
        workedOn: "2026-11-03",
        billable: false,
      },
      db,
    );

    const drawn = await figures(project.id);

    expect(valueOf(drawn, "Burned")).toBe("$1,800.00");
    expect(drawn.find((row) => row.label === "Burned")?.note).toContain(
      "5h not chargeable",
    );
  });

  it("shows the whole contract before anything is logged", async () => {
    const project = await createProject(
      { clientId, name: "Not started", contractValueCents: 500_000 },
      db,
    );

    const drawn = await figures(project.id);

    expect(valueOf(drawn, "Burned")).toBe("None yet");
    expect(valueOf(drawn, "Remaining")).toBe("$5,000.00");
    expect(valueOf(drawn, "Consumed")).toBe("0%");
  });
});

describe("the burn panel over rows with something missing", () => {
  it("flags a project whose client has no default rate either", async () => {
    const unrated = await createClient({ name: "No Rate Co" }, db);
    const project = await createProject(
      {
        clientId: unrated.id,
        name: "Unvalued",
        contractValueCents: 500_000,
      },
      db,
    );
    await createTimeEntry(
      { projectId: project.id, minutes: 600, workedOn: "2026-11-02" },
      db,
    );

    const summary = await summaryFor(project.id);

    expect(valueOf(burnFigures(summary), "Burned")).toBe("No rate set");
    expect(burnProblems(summary)).toHaveLength(1);
  });

  it("drops the comparisons for a project with no contract value", async () => {
    const project = await createProject({ clientId, name: "Unpriced" }, db);
    await createTimeEntry(
      { projectId: project.id, minutes: 600, workedOn: "2026-11-02" },
      db,
    );

    const drawn = await figures(project.id);

    expect(drawn.map((row) => row.label)).toEqual(["Contracted", "Burned"]);
    expect(valueOf(drawn, "Contracted")).toBe("Not set");
    expect(valueOf(drawn, "Burned")).toBe("$1,800.00");
  });
});
