import { describe, expect, it } from "vitest";

import { optionalEmail } from "./email";

function rejection(input: string, label?: string): string {
  const result = optionalEmail(input, label);
  if (result.ok) throw new Error(`expected ${input} to be rejected`);
  return result.message;
}

describe("optionalEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(optionalEmail("ada@example.com")).toEqual({
      ok: true,
      value: "ada@example.com",
    });
    expect(optionalEmail("ada.lovelace+keel@mail.example.co.uk")).toEqual({
      ok: true,
      value: "ada.lovelace+keel@mail.example.co.uk",
    });
  });

  it("trims but does not rewrite the case of what was typed", () => {
    expect(optionalEmail("  Ada@Example.com ")).toEqual({
      ok: true,
      value: "Ada@Example.com",
    });
  });

  it("treats a blank field as absent", () => {
    expect(optionalEmail("")).toEqual({ ok: true, value: null });
    expect(optionalEmail("   ")).toEqual({ ok: true, value: null });
  });

  it("rejects the shapes that are always a typo", () => {
    const message = "Email does not look like an email address.";
    expect(rejection("ada")).toBe(message);
    expect(rejection("ada@")).toBe(message);
    expect(rejection("@example.com")).toBe(message);
    expect(rejection("ada@example")).toBe(message);
    expect(rejection("ada@@example.com")).toBe(message);
    expect(rejection("ada@.com")).toBe(message);
    expect(rejection("ada@example.")).toBe(message);
    expect(rejection("ada lovelace@example.com")).toBe(message);
  });

  it("rejects an address past the RFC length limit", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(rejection(long)).toBe("Email must be 254 characters or fewer.");
  });

  it("names the field the caller gave it", () => {
    expect(rejection("nope", "Billing email")).toBe(
      "Billing email does not look like an email address.",
    );
  });
});
