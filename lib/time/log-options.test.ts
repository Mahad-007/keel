import { describe, expect, it } from "vitest";

import type { ProjectWithClient } from "@/lib/data/projects";

import {
  clientFilterOptions,
  describeMissingFilters,
  projectFilterOptions,
  resolveLogFilters,
} from "./log-options";

/** A project row with only the fields a picker reads filled in properly. */
function project(
  partial: Partial<ProjectWithClient> & Pick<ProjectWithClient, "id" | "name">,
): ProjectWithClient {
  return {
    clientId: "cli_harbour",
    clientName: "Harbour Co",
    clientArchivedAt: null,
    clientDefaultRateCents: 0,
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

describe("describeMissingFilters", () => {
  it("says nothing when both filters are on offer", () => {
    expect(describeMissingFilters({ projectGone: false, clientGone: false })).toBeNull();
  });

  it("names the project filter on its own", () => {
    expect(describeMissingFilters({ projectGone: true, clientGone: false })).toMatch(
      /^The project filter names a project that is no longer on the list/,
    );
  });

  it("names the client filter on its own", () => {
    expect(describeMissingFilters({ projectGone: false, clientGone: true })).toMatch(
      /^The client filter names a client that is no longer on the list/,
    );
  });

  it("names both at once in one sentence", () => {
    expect(describeMissingFilters({ projectGone: true, clientGone: true })).toMatch(
      /^The project and client filters both name something/,
    );
  });

  it("stays grammatical when it is talking about two filters", () => {
    const note = describeMissingFilters({ projectGone: true, clientGone: true }) ?? "";
    expect(note).toContain("narrowed to them");
    expect(note).toContain("the pickers show");
    expect(note).not.toContain("narrowed to it");
  });

  it("stays singular when it is talking about one", () => {
    const note = describeMissingFilters({ projectGone: false, clientGone: true }) ?? "";
    expect(note).toContain("narrowed to it");
    expect(note).toContain("the picker shows");
  });

  it("always says the filter is still in force and how to clear it", () => {
    const note = describeMissingFilters({ projectGone: true, clientGone: false }) ?? "";
    expect(note).toContain("still narrowed");
    expect(note).toContain("clearing the filters");
  });
});


describe("resolveLogFilters", () => {
  const SITE = project({ id: "prj_site", name: "Site rebuild" });
  const BRAND = project({
    id: "prj_brand",
    name: "Brand refresh",
    clientId: "cli_pell",
    clientName: "Pell & Sons",
  });
  const BOOK = [SITE, BRAND];

  it("names nothing when nothing is filtered", () => {
    expect(
      resolveLogFilters({ projectId: null, clientId: null }, BOOK),
    ).toEqual({
      project: null,
      client: null,
      projectGone: false,
      clientGone: false,
      mismatched: false,
    });
  });

  it("names a filtered project with its client, when no client is filtered", () => {
    const resolved = resolveLogFilters(
      { projectId: "prj_brand", clientId: null },
      BOOK,
    );

    expect(resolved.project).toBe("Pell & Sons — Brand refresh");
    expect(resolved.projectGone).toBe(false);
  });

  it("drops the client's name from the project once the client is filtered", () => {
    const resolved = resolveLogFilters(
      { projectId: "prj_brand", clientId: "cli_pell" },
      BOOK,
    );

    expect(resolved.project).toBe("Brand refresh");
    expect(resolved.client).toBe("Pell & Sons");
    expect(resolved.mismatched).toBe(false);
  });

  it("names a client off any one of their projects", () => {
    expect(
      resolveLogFilters({ projectId: null, clientId: "cli_harbour" }, BOOK)
        .client,
    ).toBe("Harbour Co");
  });

  it("marks a client who is archived but still has projects", () => {
    const archived = project({
      id: "prj_old",
      name: "Leaflet",
      clientId: "cli_old",
      clientName: "Mott",
      clientArchivedAt: "2026-09-01T09:00:00.000Z",
    });

    expect(
      resolveLogFilters({ projectId: null, clientId: "cli_old" }, [archived])
        .client,
    ).toBe("Mott (archived)");
  });

  it("says a project that names nothing is gone", () => {
    const resolved = resolveLogFilters(
      { projectId: "prj_gone", clientId: null },
      BOOK,
    );

    expect(resolved.projectGone).toBe(true);
    expect(resolved.project).toBeNull();
    expect(resolved.mismatched).toBe(false);
  });

  it("says a client who has no project at all is gone", () => {
    const resolved = resolveLogFilters(
      { projectId: null, clientId: "cli_gone" },
      BOOK,
    );

    expect(resolved.clientGone).toBe(true);
    expect(resolved.client).toBeNull();
  });

  it("does not call another client's project gone", () => {
    const resolved = resolveLogFilters(
      { projectId: "prj_site", clientId: "cli_pell" },
      BOOK,
    );

    expect(resolved.projectGone).toBe(false);
    expect(resolved.clientGone).toBe(false);
    expect(resolved.mismatched).toBe(true);
    expect(resolved.project).toBe("Site rebuild");
    expect(resolved.client).toBe("Pell & Sons");
  });

  it("is not a mismatch when the project is the filtered client's", () => {
    expect(
      resolveLogFilters(
        { projectId: "prj_site", clientId: "cli_harbour" },
        BOOK,
      ).mismatched,
    ).toBe(false);
  });

  it("is not a mismatch when one of the two names nothing", () => {
    expect(
      resolveLogFilters({ projectId: "prj_gone", clientId: "cli_pell" }, BOOK)
        .mismatched,
    ).toBe(false);
    expect(
      resolveLogFilters({ projectId: "prj_site", clientId: "cli_gone" }, BOOK)
        .mismatched,
    ).toBe(false);
  });

  it("says nothing is missing when the two merely disagree", () => {
    expect(
      describeMissingFilters(
        resolveLogFilters(
          { projectId: "prj_site", clientId: "cli_pell" },
          BOOK,
        ),
      ),
    ).toBeNull();
  });
});
