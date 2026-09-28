import { describe, expect, it } from "vitest";

import { requiredChoice } from "./choice";

const CLIENTS = ["cli_ada", "cli_grace"] as const;
const OPTIONS = { label: "Client" };

describe("requiredChoice", () => {
  it("accepts a value that is on the list", () => {
    expect(requiredChoice("cli_grace", CLIENTS, OPTIONS)).toEqual({
      ok: true,
      value: "cli_grace",
    });
  });

  it("trims the submitted value before checking it", () => {
    expect(requiredChoice("  cli_ada  ", CLIENTS, OPTIONS)).toEqual({
      ok: true,
      value: "cli_ada",
    });
  });

  it("rejects a field nothing was picked in", () => {
    expect(requiredChoice("", CLIENTS, OPTIONS)).toEqual({
      ok: false,
      message: "Client is required.",
    });
    expect(requiredChoice("   ", CLIENTS, OPTIONS)).toEqual({
      ok: false,
      message: "Client is required.",
    });
  });

  it("rejects a value that was never offered", () => {
    expect(requiredChoice("cli_nobody", CLIENTS, OPTIONS)).toEqual({
      ok: false,
      message: "Client is not one of the options offered.",
    });
  });

  it("says what the caller asked it to when the value is unknown", () => {
    expect(
      requiredChoice("cli_nobody", CLIENTS, {
        label: "Client",
        unknown: "That client is no longer on your list.",
      }),
    ).toEqual({ ok: false, message: "That client is no longer on your list." });
  });

  it("rejects everything when there is nothing on offer", () => {
    expect(requiredChoice("cli_ada", [], OPTIONS)).toEqual({
      ok: false,
      message: "Client is not one of the options offered.",
    });
  });
});
