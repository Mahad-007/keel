import { describe, expect, it } from "vitest";

import { collect, invalid, valid } from "./result";

describe("collect", () => {
  it("hands back every value when each field is valid", () => {
    const result = collect({
      name: valid("Ada"),
      rateCents: valid(15000),
    });

    expect(result).toEqual({ ok: true, value: { name: "Ada", rateCents: 15000 } });
  });

  it("reports every bad field at once, not just the first", () => {
    const result = collect({
      name: invalid<string>("Name is required."),
      email: valid<string | null>(null),
      rateCents: invalid<number>("Rate is not an amount."),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a failure");
    expect(result.errors).toEqual({
      name: "Name is required.",
      rateCents: "Rate is not an amount.",
    });
  });

  it("keeps no value for a field that failed", () => {
    const result = collect({ name: invalid<string>("Name is required.") });

    if (result.ok) throw new Error("expected a failure");
    expect(Object.keys(result.errors)).toEqual(["name"]);
  });

  it("treats a form with no fields as valid", () => {
    expect(collect({})).toEqual({ ok: true, value: {} });
  });

  it("preserves falsy values rather than mistaking them for absent", () => {
    const result = collect({ rateCents: valid(0), notes: valid<string | null>(null) });

    expect(result).toEqual({ ok: true, value: { rateCents: 0, notes: null } });
  });
});
