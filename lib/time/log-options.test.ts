import { describe, expect, it } from "vitest";

import type { ProjectWithClient } from "@/lib/data/projects";

import { clientFilterOptions, projectFilterOptions } from "./log-options";

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

describe("projectFilterOptions", () => {
  it("offers nothing when there are no projects", () => {
    expect(projectFilterOptions([])).toEqual([]);
  });

  it("leads each label with the client when every client is in play", () => {
    const options = projectFilterOptions([
      project({ id: "prj_one", name: "Site rebuild" }),
    ]);

    expect(options).toEqual([
      { value: "prj_one", label: "Harbour Co — Site rebuild" },
    ]);
  });

  it("drops the client's name once the log is narrowed to them", () => {
    const options = projectFilterOptions(
      [project({ id: "prj_one", name: "Site rebuild" })],
      "cli_harbour",
    );

    expect(options).toEqual([{ value: "prj_one", label: "Site rebuild" }]);
  });

  it("leaves out the projects of every other client", () => {
    const options = projectFilterOptions(
      [
        project({ id: "prj_one", name: "Site rebuild" }),
        project({
          id: "prj_two",
          name: "Brand refresh",
          clientId: "cli_pell",
          clientName: "Pell & Sons",
        }),
      ],
      "cli_pell",
    );

    expect(options.map((option) => option.value)).toEqual(["prj_two"]);
  });

  it("groups a client's projects together and orders them by name", () => {
    const options = projectFilterOptions([
      project({ id: "prj_a", name: "Website", clientId: "cli_z", clientName: "Zephyr" }),
      project({ id: "prj_b", name: "Packaging", clientId: "cli_a", clientName: "Acme" }),
      project({ id: "prj_c", name: "Brochure", clientId: "cli_a", clientName: "Acme" }),
    ]);

    expect(options.map((option) => option.label)).toEqual([
      "Acme — Brochure",
      "Acme — Packaging",
      "Zephyr — Website",
    ]);
  });

  it("gives two identically named projects of one client a fixed order", () => {
    const options = projectFilterOptions([
      project({ id: "prj_second", name: "Website" }),
      project({ id: "prj_first", name: "Website" }),
    ]);

    expect(options.map((option) => option.value)).toEqual([
      "prj_first",
      "prj_second",
    ]);
  });

  it("offers nothing for a client who has no project", () => {
    const options = projectFilterOptions(
      [project({ id: "prj_one", name: "Site rebuild" })],
      "cli_gone",
    );

    expect(options).toEqual([]);
  });
});
