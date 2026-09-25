import { describe, expect, it } from "vitest";

import {
  optionalCents,
  optionalText,
  requiredText,
  wholeCents,
} from "./fields";

describe("requiredText", () => {
  it("returns the value with surrounding whitespace removed", () => {
    expect(requiredText("  Redesign  ", "project name")).toBe("Redesign");
  });

  it("keeps whitespace inside the value", () => {
    expect(requiredText(" Site  Redesign ", "project name")).toBe(
      "Site  Redesign",
    );
  });

  it("refuses a blank value", () => {
    expect(() => requiredText("", "project name")).toThrow(
      "project name is required",
    );
  });

  it("refuses a value that is only whitespace", () => {
    expect(() => requiredText("  \t\n ", "project name")).toThrow(
      "project name is required",
    );
  });

  it("names the field so the error says which column complained", () => {
    expect(() => requiredText("", "client name")).toThrow(/client name/);
  });
});

describe("optionalText", () => {
  it("returns a real value trimmed", () => {
    expect(optionalText("  a note  ")).toBe("a note");
  });

  it("treats undefined, null, and blank alike as NULL", () => {
    expect(optionalText(undefined)).toBeNull();
    expect(optionalText(null)).toBeNull();
    expect(optionalText("")).toBeNull();
    expect(optionalText("   ")).toBeNull();
  });

  it("keeps a value that is only punctuation or digits", () => {
    expect(optionalText("0")).toBe("0");
    expect(optionalText("-")).toBe("-");
  });
});

describe("wholeCents", () => {
  it("accepts a whole number of cents", () => {
    expect(wholeCents(150000, "contract value")).toBe(150000);
  });

  it("accepts zero, which is how an unset amount is stored", () => {
    expect(wholeCents(0, "contract value")).toBe(0);
  });

  it("refuses a fraction of a cent", () => {
    expect(() => wholeCents(100.5, "contract value")).toThrow(
      /contract value must be whole cents, got 100.5/,
    );
  });

  it("refuses a negative amount", () => {
    expect(() => wholeCents(-1, "contract value")).toThrow(
      /contract value cannot be negative, got -1/,
    );
  });

  it("refuses an amount past the exact integer range", () => {
    expect(() => wholeCents(Number.MAX_SAFE_INTEGER + 2, "contract value")).toThrow(
      /whole cents/,
    );
    expect(() => wholeCents(1e20, "contract value")).toThrow(/whole cents/);
  });

  it("accepts the largest amount that is still exact", () => {
    expect(wholeCents(Number.MAX_SAFE_INTEGER, "contract value")).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("refuses NaN and infinity rather than storing them", () => {
    expect(() => wholeCents(Number.NaN, "contract value")).toThrow(
      /whole cents/,
    );
    expect(() => wholeCents(Number.POSITIVE_INFINITY, "contract value")).toThrow(
      /whole cents/,
    );
  });
});

describe("optionalCents", () => {
  it("passes an amount through the same checks as a required one", () => {
    expect(optionalCents(9900, "rate override")).toBe(9900);
    expect(() => optionalCents(99.5, "rate override")).toThrow(/whole cents/);
    expect(() => optionalCents(-5, "rate override")).toThrow(/negative/);
  });

  it("treats undefined and null as no override at all", () => {
    expect(optionalCents(undefined, "rate override")).toBeNull();
    expect(optionalCents(null, "rate override")).toBeNull();
  });

  it("keeps a deliberate zero, which is not the same as no override", () => {
    expect(optionalCents(0, "rate override")).toBe(0);
  });
});
