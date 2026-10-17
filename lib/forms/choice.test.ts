import { describe, expect, it } from "vitest";

import { optionalChoice, requiredChoice } from "./choice";

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

describe("optionalChoice", () => {
  const ids = ["dlv_wireframes", "dlv_build"] as const;

  it("accepts one of the options", () => {
    expect(optionalChoice("dlv_build", ids, { label: "Deliverable" })).toEqual({
      ok: true,
      value: "dlv_build",
    });
  });

  it("reads a blank choice as none of them, not as a missing field", () => {
    expect(optionalChoice("", ids, { label: "Deliverable" })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("reads a choice of only spaces as none of them", () => {
    expect(optionalChoice("   ", ids, { label: "Deliverable" })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("trims a choice before matching it", () => {
    expect(
      optionalChoice(" dlv_build ", ids, { label: "Deliverable" }),
    ).toEqual({ ok: true, value: "dlv_build" });
  });

  it("refuses a value that was never on offer", () => {
    expect(optionalChoice("dlv_other", ids, { label: "Deliverable" })).toEqual({
      ok: false,
      message: "Deliverable is not one of the options offered.",
    });
  });

  it("refuses with the caller's own sentence when it has one", () => {
    expect(
      optionalChoice("dlv_other", ids, {
        label: "Deliverable",
        unknown: "That deliverable is no longer on this project.",
      }),
    ).toEqual({
      ok: false,
      message: "That deliverable is no longer on this project.",
    });
  });

  it("refuses everything when nothing is on offer", () => {
    // A project with no deliverables offers no attribution, so the only valid
    // answer is the blank one.
    expect(optionalChoice("dlv_build", [], { label: "Deliverable" }).ok).toBe(
      false,
    );
    expect(optionalChoice("", [], { label: "Deliverable" })).toEqual({
      ok: true,
      value: null,
    });
  });
});
