import { describe, expect, it } from "vitest";

import { matchesFingerprint, textFingerprint } from "./fingerprint";

const PASTE = "Discovery | 2\nWireframes | 6\nBuild";

describe("the stamp a piece of text gets", () => {
  it("is the same every time for the same text", () => {
    expect(textFingerprint(PASTE)).toBe(textFingerprint(PASTE));
  });

  it("changes when a character changes", () => {
    expect(textFingerprint("Discovery | 2")).not.toBe(
      textFingerprint("Discovery | 3"),
    );
  });

  it("changes when a line is added", () => {
    expect(textFingerprint(PASTE)).not.toBe(textFingerprint(`${PASTE}\nLaunch`));
  });

  it("changes when two lines swap places", () => {
    expect(textFingerprint("Discovery\nBuild")).not.toBe(
      textFingerprint("Build\nDiscovery"),
    );
  });

  it("changes when whitespace is added, because the text has", () => {
    expect(textFingerprint("Discovery")).not.toBe(textFingerprint("Discovery "));
  });

  it("is short enough to sit in a hidden field", () => {
    expect(textFingerprint("W".repeat(20_000)).length).toBeLessThan(20);
  });

  it("stamps an empty string without throwing", () => {
    expect(textFingerprint("")).toBe(textFingerprint(""));
  });
});

describe("checking text against the stamp submitted with it", () => {
  it("matches text that has not moved", () => {
    expect(matchesFingerprint(textFingerprint(PASTE), PASTE)).toBe(true);
  });

  it("refuses text edited after it was stamped", () => {
    expect(matchesFingerprint(textFingerprint(PASTE), `${PASTE}\nLaunch`)).toBe(
      false,
    );
  });

  it("refuses a submission carrying no stamp at all", () => {
    expect(matchesFingerprint("", PASTE)).toBe(false);
    expect(matchesFingerprint("   ", PASTE)).toBe(false);
  });

  it("refuses a stamp that is not one of ours", () => {
    expect(matchesFingerprint("not-a-stamp", PASTE)).toBe(false);
  });

  it("tolerates the whitespace a hidden field might pick up", () => {
    expect(matchesFingerprint(` ${textFingerprint(PASTE)} `, PASTE)).toBe(true);
  });
});
