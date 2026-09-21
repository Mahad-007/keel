import { describe, expect, it } from "vitest";

import { optionalText, requiredText } from "./text";

const NAME = { label: "Name", max: 10 };

describe("requiredText", () => {
  it("trims and accepts a value", () => {
    expect(requiredText("  Ada  ", NAME)).toEqual({ ok: true, value: "Ada" });
  });

  it("rejects an empty field by name", () => {
    expect(requiredText("", NAME)).toEqual({
      ok: false,
      message: "Name is required.",
    });
  });

  it("treats whitespace as empty", () => {
    expect(requiredText("   \t\n ", NAME)).toEqual({
      ok: false,
      message: "Name is required.",
    });
  });

  it("accepts a value exactly at the limit", () => {
    expect(requiredText("0123456789", NAME)).toEqual({
      ok: true,
      value: "0123456789",
    });
  });

  it("rejects a value one character past the limit", () => {
    expect(requiredText("0123456789x", NAME)).toEqual({
      ok: false,
      message: "Name must be 10 characters or fewer.",
    });
  });

  it("measures length after trimming, not before", () => {
    expect(requiredText("   Ada    ", { label: "Name", max: 3 })).toEqual({
      ok: true,
      value: "Ada",
    });
  });
});

describe("optionalText", () => {
  it("turns a blank field into null", () => {
    expect(optionalText("", NAME)).toEqual({ ok: true, value: null });
    expect(optionalText("   ", NAME)).toEqual({ ok: true, value: null });
  });

  it("trims a value that is present", () => {
    expect(optionalText(" Navy ", NAME)).toEqual({ ok: true, value: "Navy" });
  });

  it("still enforces the length ceiling", () => {
    expect(optionalText("0123456789x", { label: "Company", max: 10 })).toEqual({
      ok: false,
      message: "Company must be 10 characters or fewer.",
    });
  });
});
