import { describe, expect, it } from "vitest";

import { copiedDeliverables, copiedProject } from "./duplicate";

/**
 * A project worth copying: filed under a client, agreed at a figure, billing
 * at a rate of its own.
 */
const SOURCE = {
  clientId: "cli_harbour",
  contractValueCents: 1_200_000,
  rateCents: 9_500,
};

describe("copiedProject", () => {
  it("files the copy under the same client", () => {
    expect(copiedProject(SOURCE, "Site rebuild (copy)").clientId).toBe(
      "cli_harbour",
    );
  });

  it("takes the name from the caller, not from the source", () => {
    expect(copiedProject(SOURCE, "Site rebuild, phase two").name).toBe(
      "Site rebuild, phase two",
    );
  });

  it("carries the agreed contract value across", () => {
    expect(
      copiedProject(SOURCE, "Site rebuild (copy)").contractValueCents,
    ).toBe(1_200_000);
  });

  it("carries the rate override across", () => {
    expect(copiedProject(SOURCE, "Site rebuild (copy)").rateCents).toBe(9_500);
  });

  it("keeps an absent rate override absent rather than zeroing it", () => {
    const copy = copiedProject({ ...SOURCE, rateCents: null }, "Copy");

    expect(copy.rateCents).toBeNull();
  });

  it("keeps a rate override of zero, which is not the same as absent", () => {
    const copy = copiedProject({ ...SOURCE, rateCents: 0 }, "Copy");

    expect(copy.rateCents).toBe(0);
  });
});

/**
 * The half of this function nobody can see by reading a duplicate: the
 * columns that stayed behind. A copy that quietly carried `startedAt` would
 * look right on every page in the app and be wrong in the only place it
 * matters — a draft claiming it began in March.
 */
describe("copiedProject, on what it leaves behind", () => {
  /**
   * The row as the database hands it over: a project that ran from March to
   * August, carrying every column a copy must not inherit.
   */
  const ROW = {
    id: "prj_source",
    ...SOURCE,
    status: "closed",
    startedAt: "2026-03-01",
    closedAt: "2026-08-31",
    createdAt: "2026-02-01T09:00:00.000Z",
    updatedAt: "2026-08-31T09:00:00.000Z",
  };

  it("carries nothing beyond the four fields a new project is made of", () => {
    // Exhaustive rather than one assertion per column left behind: this says
    // the same thing about the id, the status, both lifecycle dates and both
    // timestamps, and it keeps saying it about a column added next year.
    expect(Object.keys(copiedProject(ROW, "Copy")).sort()).toEqual([
      "clientId",
      "contractValueCents",
      "name",
      "rateCents",
    ]);
  });
});

/** A scope list with the three shapes a real one has: detailed, bare, unestimated. */
const SCOPE = [
  { title: "Discovery", description: "Two workshops.", estimatedMinutes: 480 },
  { title: "Build", description: null, estimatedMinutes: 2_400 },
  { title: "Handover", description: "Training day.", estimatedMinutes: 0 },
];

describe("copiedDeliverables", () => {
  it("copies every line, in the order they were agreed", () => {
    expect(copiedDeliverables(SCOPE).map((line) => line.title)).toEqual([
      "Discovery",
      "Build",
      "Handover",
    ]);
  });

  it("carries the detail behind each title", () => {
    const [discovery, build] = copiedDeliverables(SCOPE);

    expect(discovery.description).toBe("Two workshops.");
    expect(build.description).toBeNull();
  });

  it("carries each estimate as it stands", () => {
    expect(
      copiedDeliverables(SCOPE).map((line) => line.estimatedMinutes),
    ).toEqual([480, 2_400, 0]);
  });

  it("keeps an unestimated line rather than dropping it", () => {
    expect(copiedDeliverables(SCOPE)).toHaveLength(3);
  });

  it("copies nothing from a project with no scope agreed", () => {
    expect(copiedDeliverables([])).toEqual([]);
  });
});

/**
 * The other half of the copy decision, and the one a duplicate cannot show
 * you: a line that carried its status would open the copy half delivered.
 */
describe("copiedDeliverables, on what it leaves behind", () => {
  /** The rows as the database hands them over, part-way through the work. */
  const ROWS = [
    {
      id: "dlv_discovery",
      projectId: "prj_source",
      title: "Discovery",
      description: "Two workshops.",
      estimatedMinutes: 480,
      status: "done",
      sortOrder: 0,
      createdAt: "2026-02-01T09:00:00.000Z",
      updatedAt: "2026-03-01T09:00:00.000Z",
    },
    {
      id: "dlv_build",
      projectId: "prj_source",
      title: "Build",
      description: null,
      estimatedMinutes: 2_400,
      status: "started",
      sortOrder: 1,
      createdAt: "2026-02-01T09:00:00.000Z",
      updatedAt: "2026-03-01T09:00:00.000Z",
    },
  ];

  it("carries nothing beyond the three fields a line is copied from", () => {
    // The same exhaustive assertion as the project half, and it covers the
    // same ground: the ids, the project, the progress, the position and both
    // timestamps are all absent because the keys are these three.
    for (const line of copiedDeliverables(ROWS)) {
      expect(Object.keys(line).sort()).toEqual([
        "description",
        "estimatedMinutes",
        "title",
      ]);
    }
  });

  it("copies the three it does carry off the stored row", () => {
    expect(copiedDeliverables(ROWS)[0]).toEqual({
      title: "Discovery",
      description: "Two workshops.",
      estimatedMinutes: 480,
    });
  });
});
