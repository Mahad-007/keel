import { describe, expect, it } from "vitest";

import type { Client } from "@/lib/db/schema";
import { firstErrorField, rejectedFormState } from "@/lib/forms/state";

import {
  clientFormFields,
  clientFormStateFor,
  CLIENT_FIELD_LIMITS,
  CLIENT_FIELD_NAMES,
  EMPTY_CLIENT_FIELDS,
  parseClientForm,
  readClientFields,
  type ClientFieldErrors,
  type ClientFormFields,
} from "./form";

function fields(overrides: Partial<ClientFormFields> = {}): ClientFormFields {
  return { ...EMPTY_CLIENT_FIELDS, name: "Ada Lovelace", ...overrides };
}

function errorsFrom(overrides: Partial<ClientFormFields>): ClientFieldErrors {
  const result = parseClientForm(fields(overrides));
  if (result.ok) throw new Error("expected the form to be rejected");
  return result.errors;
}

describe("parseClientForm", () => {
  it("accepts a fully filled form and converts the rate to cents", () => {
    const result = parseClientForm({
      name: "  Ada Lovelace ",
      email: " ada@example.com",
      company: "Analytical Engines ",
      notes: " Pays on time. ",
      defaultRate: "$150.00",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        notes: "Pays on time.",
        defaultRateCents: 15000,
      },
    });
  });

  it("accepts a form with only a name, nulling the optional fields", () => {
    const result = parseClientForm(fields());

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Ada Lovelace",
        email: null,
        company: null,
        notes: null,
        defaultRateCents: 0,
      },
    });
  });

  it("requires a name", () => {
    expect(errorsFrom({ name: "" })).toEqual({ name: "Name is required." });
    expect(errorsFrom({ name: "   " })).toEqual({ name: "Name is required." });
  });

  it.each([
    ["name", "Name"],
    ["company", "Company"],
    ["notes", "Notes"],
  ] as const)("caps %s at the published limit", (field, label) => {
    const max = CLIENT_FIELD_LIMITS[field];

    expect(parseClientForm(fields({ [field]: "a".repeat(max) })).ok).toBe(true);
    expect(errorsFrom({ [field]: "a".repeat(max + 1) })).toEqual({
      [field]: `${label} must be ${max} characters or fewer.`,
    });
  });

  it("rejects an email that is not an address", () => {
    expect(errorsFrom({ email: "ada at example.com" })).toEqual({
      email: "Email does not look like an email address.",
    });
  });

  it("rejects a rate that is not an amount", () => {
    expect(errorsFrom({ defaultRate: "one fifty" })).toEqual({
      defaultRate: "Default rate must be an amount, like 150 or 150.00.",
    });
  });

  it("rejects a negative rate", () => {
    expect(errorsFrom({ defaultRate: "-150" })).toEqual({
      defaultRate: "Default rate cannot be negative.",
    });
  });

  it("rejects an implausibly large rate", () => {
    expect(errorsFrom({ defaultRate: "1000000" })).toEqual({
      defaultRate: "Default rate must be $10,000.00 or less.",
    });
  });

  it("reports every bad field in one pass", () => {
    expect(
      errorsFrom({ name: "", email: "nope", defaultRate: "-1" }),
    ).toEqual({
      name: "Name is required.",
      email: "Email does not look like an email address.",
      defaultRate: "Default rate cannot be negative.",
    });
  });

  it("produces input the data layer accepts unchanged", () => {
    const result = parseClientForm(fields({ defaultRate: "0" }));

    if (!result.ok) throw new Error("expected the form to be accepted");
    expect(Number.isInteger(result.value.defaultRateCents)).toBe(true);
    expect(result.value.defaultRateCents).toBeGreaterThanOrEqual(0);
  });
});

describe("readClientFields", () => {
  it("reads exactly the client fields off a submission", () => {
    const form = new FormData();
    form.set("name", "Ada");
    form.set("defaultRate", "150");
    form.set("id", "cli_smuggled");

    expect(readClientFields(form)).toEqual({
      name: "Ada",
      email: "",
      company: "",
      notes: "",
      defaultRate: "150",
    });
  });
});

describe("CLIENT_FIELD_NAMES", () => {
  // The form focuses `firstErrorField(state, CLIENT_FIELD_NAMES)` after a
  // rejection. Walked in the wrong order it skips past an error the user can
  // already see, so the order is behaviour, not bookkeeping.
  it("walks errors in the order the form renders the fields", () => {
    const errors = errorsFrom({
      company: "a".repeat(121),
      email: "nope",
      notes: "b".repeat(2001),
      defaultRate: "-1",
    });
    const state = rejectedFormState(EMPTY_CLIENT_FIELDS, errors);

    expect(firstErrorField(state, CLIENT_FIELD_NAMES)).toBe("company");
  });

  it("puts the name above every other field", () => {
    const state = rejectedFormState(
      EMPTY_CLIENT_FIELDS,
      errorsFrom({ name: "", email: "nope" }),
    );

    expect(firstErrorField(state, CLIENT_FIELD_NAMES)).toBe("name");
  });
});

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "cli_test",
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines",
    notes: "Pays on time.",
    defaultRateCents: 15000,
    archivedAt: null,
    createdAt: "2026-09-21T09:00:00.000Z",
    updatedAt: "2026-09-21T09:00:00.000Z",
    ...overrides,
  };
}

describe("clientFormFields", () => {
  it("fills every field from the stored client", () => {
    expect(clientFormFields(client())).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      notes: "Pays on time.",
      defaultRate: "150.00",
    });
  });

  it("shows a NULL column as a blank input", () => {
    expect(
      clientFormFields(client({ email: null, company: null, notes: null })),
    ).toMatchObject({ email: "", company: "", notes: "" });
  });

  it("shows an unset rate as a blank input rather than 0.00", () => {
    expect(clientFormFields(client({ defaultRateCents: 0 })).defaultRate).toBe("");
  });

  it("covers exactly the fields the form renders", () => {
    expect(Object.keys(clientFormFields(client())).sort()).toEqual(
      [...CLIENT_FIELD_NAMES].sort(),
    );
  });

  it("re-parses to the values it came from, so a no-op edit is a no-op", () => {
    const stored = client();

    const reparsed = parseClientForm(clientFormFields(stored));

    expect(reparsed).toEqual({
      ok: true,
      value: {
        name: stored.name,
        email: stored.email,
        company: stored.company,
        notes: stored.notes,
        defaultRateCents: stored.defaultRateCents,
      },
    });
  });

  it("re-parses an all-blank client back to the same absences", () => {
    const stored = client({
      email: null,
      company: null,
      notes: null,
      defaultRateCents: 0,
    });

    expect(parseClientForm(clientFormFields(stored))).toEqual({
      ok: true,
      value: {
        name: stored.name,
        email: null,
        company: null,
        notes: null,
        defaultRateCents: 0,
      },
    });
  });
});

describe("clientFormStateFor", () => {
  it("starts an edit form prefilled and with nothing flagged", () => {
    const state = clientFormStateFor(client());

    expect(state.fields.name).toBe("Ada Lovelace");
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
  });
});
