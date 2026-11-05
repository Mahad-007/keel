import { describe, expect, it } from "vitest";

import type { ProjectWithClient } from "@/lib/data/projects";

import { clientFilterOptions } from "./log-options";

/** A project row with only the fields a picker reads filled in properly. */
function project(
  partial: Partial<ProjectWithClient> & Pick<ProjectWithClient, "id" | "name">,
): ProjectWithClient {
  return {
    clientId: "cli_harbour",
    clientName: "Harbour Co",
    clientArchivedAt: null,
    status: "active",
    contractValueCents: 0,
    rateCents: null,
    startedAt: null,
    closedAt: null,
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...partial,
  };
}

describe("clientFilterOptions", () => {
  it("offers nothing when there are no projects", () => {
    expect(clientFilterOptions([])).toEqual([]);
  });

  it("offers a client once however many projects they have", () => {
    const options = clientFilterOptions([
      project({ id: "prj_one", name: "Site rebuild" }),
      project({ id: "prj_two", name: "Packaging" }),
    ]);

    expect(options).toEqual([{ value: "cli_harbour", label: "Harbour Co" }]);
  });

  it("reads in alphabetical order whatever order the projects arrived in", () => {
    const options = clientFilterOptions([
      project({ id: "prj_one", name: "A", clientId: "cli_z", clientName: "zephyr" }),
      project({ id: "prj_two", name: "B", clientId: "cli_a", clientName: "Acme" }),
    ]);

    expect(options.map((option) => option.label)).toEqual(["Acme", "zephyr"]);
  });

  it("keeps two clients who share a name apart", () => {
    const options = clientFilterOptions([
      project({ id: "prj_one", name: "A", clientId: "cli_one", clientName: "James" }),
      project({ id: "prj_two", name: "B", clientId: "cli_two", clientName: "James" }),
    ]);

    expect(options.map((option) => option.value)).toEqual([
      "cli_one",
      "cli_two",
    ]);
  });

  it("marks a client who is off the books but still has projects", () => {
    const options = clientFilterOptions([
      project({
        id: "prj_one",
        name: "Site rebuild",
        clientArchivedAt: "2026-09-01T09:00:00.000Z",
      }),
    ]);

    expect(options[0].label).toBe("Harbour Co (archived)");
  });
});
