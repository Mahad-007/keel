import { describe, expect, it } from "vitest";

import type { Project } from "@/lib/db/schema";

import {
  EMPTY_PROJECT_FIELDS,
  INITIAL_PROJECT_FORM_STATE,
  PROJECT_FIELD_NAMES,
  parseProjectForm,
  projectFormFields,
  projectFormStateFor,
  readProjectFields,
  type ProjectFormFields,
} from "./form";

function submitted(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

describe("readProjectFields", () => {
  it("reads every field the form declares", () => {
    const fields = readProjectFields(
      submitted({
        client: "cli_ada",
        name: "Engine rewrite",
        contractValue: "12000",
        rateOverride: "180",
      }),
    );

    expect(fields).toEqual({
      client: "cli_ada",
      name: "Engine rewrite",
      contractValue: "12000",
      rateOverride: "180",
    });
  });

  it("reads a field the browser never sent as blank", () => {
    expect(readProjectFields(submitted({ name: "Engine rewrite" }))).toEqual({
      ...EMPTY_PROJECT_FIELDS,
      name: "Engine rewrite",
    });
  });

  it("ignores anything submitted under a name the form does not have", () => {
    const fields = readProjectFields(
      submitted({ name: "Engine rewrite", status: "closed" }),
    );

    expect(Object.keys(fields).sort()).toEqual([...PROJECT_FIELD_NAMES].sort());
  });
});

describe("INITIAL_PROJECT_FORM_STATE", () => {
  it("is a blank form with nothing wrong with it yet", () => {
    expect(INITIAL_PROJECT_FORM_STATE).toEqual({
      fields: EMPTY_PROJECT_FIELDS,
      errors: {},
      formError: null,
    });
  });
});

const CLIENTS = ["cli_ada", "cli_grace"];

function parse(fields: Partial<ProjectFormFields>, clientIds = CLIENTS) {
  return parseProjectForm(
    { ...EMPTY_PROJECT_FIELDS, client: "cli_ada", name: "Engine rewrite", ...fields },
    clientIds,
  );
}

function errors(fields: Partial<ProjectFormFields>, clientIds = CLIENTS) {
  const result = parse(fields, clientIds);
  if (result.ok) throw new Error("expected the form to be rejected");
  return result.errors;
}

describe("the client a project is filed under", () => {
  it("is carried through as the project's client id", () => {
    const result = parse({ client: "cli_grace" });
    expect(result.ok && result.value.clientId).toBe("cli_grace");
  });

  it("must be picked", () => {
    expect(errors({ client: "" }).client).toBe("Client is required.");
  });

  it("must be one the form offered", () => {
    expect(errors({ client: "cli_nobody" }).client).toBe(
      "That client is not one you can pick. Choose another.",
    );
  });
});

describe("a project's name", () => {
  it("comes back trimmed", () => {
    const result = parse({ name: "  Engine rewrite  " });
    expect(result.ok && result.value.name).toBe("Engine rewrite");
  });

  it("is required, and whitespace is not a name", () => {
    expect(errors({ name: "" }).name).toBe("Name is required.");
    expect(errors({ name: "   " }).name).toBe("Name is required.");
  });

  it("stops at the length the input stops at", () => {
    expect(errors({ name: "x".repeat(121) }).name).toBe(
      "Name must be 120 characters or fewer.",
    );
    expect(parse({ name: "x".repeat(120) }).ok).toBe(true);
  });
});

describe("a project's contract value", () => {
  it("becomes whole cents", () => {
    const result = parse({ contractValue: "$12,000.50" });
    expect(result.ok && result.value.contractValueCents).toBe(1_200_050);
  });

  it("is zero when nobody has agreed one yet", () => {
    const result = parse({ contractValue: "" });
    expect(result.ok && result.value.contractValueCents).toBe(0);
  });

  it("is rejected when it is not an amount", () => {
    expect(errors({ contractValue: "twelve grand" }).contractValue).toBe(
      "Contract value must be an amount, like 150 or 150.00.",
    );
  });

  it("is rejected when it is negative", () => {
    expect(errors({ contractValue: "-12000" }).contractValue).toBe(
      "Contract value cannot be negative.",
    );
  });
});

describe("a project's rate override", () => {
  it("becomes whole cents per hour", () => {
    const result = parse({ rateOverride: "180" });
    expect(result.ok && result.value.rateCents).toBe(18000);
  });

  it("is null when left blank, which means the client's rate applies", () => {
    const result = parse({ rateOverride: "" });
    expect(result.ok && result.value.rateCents).toBeNull();
  });

  it("is zero when someone means it, which is not the same as blank", () => {
    const result = parse({ rateOverride: "0" });
    expect(result.ok && result.value.rateCents).toBe(0);
  });

  it("is held to a plausible hourly rate", () => {
    expect(errors({ rateOverride: "25000" }).rateOverride).toBe(
      "Rate override must be $10,000.00 or less.",
    );
  });
});

describe("a form with several problems", () => {
  it("comes back with every one of them, not just the first", () => {
    expect(
      errors({ client: "", name: "", contractValue: "x", rateOverride: "-1" }),
    ).toEqual({
      client: "Client is required.",
      name: "Name is required.",
      contractValue: "Contract value must be an amount, like 150 or 150.00.",
      rateOverride: "Rate override cannot be negative.",
    });
  });

  it("keys them by the names the form lays out, so focus can find the first", () => {
    const keys = Object.keys(errors({ client: "", name: "" }));
    expect(PROJECT_FIELD_NAMES.filter((name) => keys.includes(name))).toEqual([
      "client",
      "name",
    ]);
  });
});

function project(fields: Partial<Project> = {}): Project {
  return {
    id: "prj_engine",
    clientId: "cli_ada",
    name: "Engine rewrite",
    status: "active",
    contractValueCents: 1_200_000,
    rateCents: 18000,
    startedAt: "2026-09-01T09:00:00.000Z",
    closedAt: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    ...fields,
  };
}

describe("projectFormFields", () => {
  it("prefills every field from the stored row", () => {
    expect(projectFormFields(project())).toEqual({
      client: "cli_ada",
      name: "Engine rewrite",
      contractValue: "12000.00",
      rateOverride: "180.00",
    });
  });

  it("offers an unagreed contract value as a blank box, not as zero", () => {
    expect(projectFormFields(project({ contractValueCents: 0 })).contractValue).toBe("");
  });

  it("offers no override as blank and an override of zero as a figure", () => {
    expect(projectFormFields(project({ rateCents: null })).rateOverride).toBe("");
    expect(projectFormFields(project({ rateCents: 0 })).rateOverride).toBe("0.00");
  });

  it("round-trips a project through the form without changing it", () => {
    for (const stored of [
      project(),
      project({ contractValueCents: 0, rateCents: null }),
      project({ rateCents: 0 }),
    ]) {
      const result = parseProjectForm(projectFormFields(stored), [stored.clientId]);
      expect(result).toEqual({
        ok: true,
        value: {
          clientId: stored.clientId,
          name: stored.name,
          contractValueCents: stored.contractValueCents,
          rateCents: stored.rateCents,
        },
      });
    }
  });
});

describe("projectFormStateFor", () => {
  it("is the stored project with nothing wrong with it yet", () => {
    expect(projectFormStateFor(project())).toEqual({
      fields: projectFormFields(project()),
      errors: {},
      formError: null,
    });
  });
});
