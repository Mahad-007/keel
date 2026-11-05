import { describe, expect, it } from "vitest";

import type { ProjectWithClient } from "@/lib/data/projects";

import {
  clientFilterOptions,
  describeMissingFilters,
  filterIsOffered,
  filterLabel,
  projectFilterOptions,
} from "./log-options";

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

describe("filterIsOffered", () => {
  const options = [{ value: "prj_one", label: "Site rebuild" }];

  it("is true for a filter the picker can offer", () => {
    expect(filterIsOffered("prj_one", options)).toBe(true);
  });

  it("is true for no filter at all", () => {
    expect(filterIsOffered(null, options)).toBe(true);
    expect(filterIsOffered(null, [])).toBe(true);
  });

  it("is false for a filter naming something that has gone", () => {
    expect(filterIsOffered("prj_gone", options)).toBe(false);
    expect(filterIsOffered("prj_one", [])).toBe(false);
  });
});

describe("describeMissingFilters", () => {
  it("says nothing when both filters are on offer", () => {
    expect(describeMissingFilters(false, false)).toBeNull();
  });

  it("names the project filter on its own", () => {
    expect(describeMissingFilters(true, false)).toMatch(
      /^The project filter names a project that is no longer on the list/,
    );
  });

  it("names the client filter on its own", () => {
    expect(describeMissingFilters(false, true)).toMatch(
      /^The client filter names a client that is no longer on the list/,
    );
  });

  it("names both at once in one sentence", () => {
    expect(describeMissingFilters(true, true)).toMatch(
      /^The project and client filters both name something/,
    );
  });

  it("always says the filter is still in force and how to clear it", () => {
    const note = describeMissingFilters(true, false) ?? "";
    expect(note).toContain("still narrowed");
    expect(note).toContain("clearing the filters");
  });
});

describe("filterLabel", () => {
  const options = [
    { value: "prj_one", label: "Site rebuild" },
    { value: "prj_two", label: "Packaging" },
  ];

  it("names the filtered option", () => {
    expect(filterLabel("prj_two", options)).toBe("Packaging");
  });

  it("is nothing when nothing is filtered", () => {
    expect(filterLabel(null, options)).toBeNull();
  });

  it("is nothing for a filter the pickers cannot offer", () => {
    expect(filterLabel("prj_gone", options)).toBeNull();
  });

  it("agrees with whether the filter is offered at all", () => {
    for (const id of ["prj_one", "prj_gone", null]) {
      expect(filterLabel(id, options) !== null).toBe(
        filterIsOffered(id, options) && id !== null,
      );
    }
  });
});
