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
