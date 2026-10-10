import { describe, expect, it } from "vitest";

import { copiedProject } from "./duplicate";

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
describe("copiedProject", () => {
  it("carries nothing beyond the four fields a new project is made of", () => {
    expect(Object.keys(copiedProject(SOURCE, "Copy")).sort()).toEqual([
      "clientId",
      "contractValueCents",
      "name",
      "rateCents",
    ]);
  });

  it("names no status, so the copy opens as a draft", () => {
    const copy: Record<string, unknown> = copiedProject(SOURCE, "Copy");

    expect(copy).not.toHaveProperty("status");
  });

  it("leaves the lifecycle dates of the source behind", () => {
    // The row as the database hands it over: a project that ran from March to
    // August, with the two columns the copy must not inherit.
    const ran = {
      ...SOURCE,
      startedAt: "2026-03-01",
      closedAt: "2026-08-31",
    };
    const copy: Record<string, unknown> = copiedProject(ran, "Copy");

    expect(copy).not.toHaveProperty("startedAt");
    expect(copy).not.toHaveProperty("closedAt");
  });

  it("does not carry the source's own id", () => {
    const row = { ...SOURCE, id: "prj_source" };
    const copy: Record<string, unknown> = copiedProject(row, "Copy");

    expect(copy).not.toHaveProperty("id");
  });
});
