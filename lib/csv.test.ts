import { describe, expect, it } from "vitest";

import { needsCsvQuoting } from "./csv";

describe("needsCsvQuoting", () => {
  it("leaves ordinary text unquoted", () => {
    expect(needsCsvQuoting("Harbour Co")).toBe(false);
    expect(needsCsvQuoting("2026-10-16")).toBe(false);
    expect(needsCsvQuoting("90")).toBe(false);
  });

  it("quotes an empty field no more than a word", () => {
    expect(needsCsvQuoting("")).toBe(false);
  });

  it("quotes a field holding the separator", () => {
    expect(needsCsvQuoting("Design, build, hand over")).toBe(true);
  });

  it("quotes a field holding a quote", () => {
    expect(needsCsvQuoting('Called it "the rebuild"')).toBe(true);
  });

  it("quotes a field holding a line feed", () => {
    expect(needsCsvQuoting("Two calls\nand an email")).toBe(true);
  });

  it("quotes a field holding a carriage return on its own", () => {
    expect(needsCsvQuoting("Two calls\rand an email")).toBe(true);
  });

  it("quotes a field whose spaces a reader would trim", () => {
    expect(needsCsvQuoting(" Harbour Co")).toBe(true);
    expect(needsCsvQuoting("Harbour Co ")).toBe(true);
    expect(needsCsvQuoting("\tHarbour Co")).toBe(true);
  });

  it("leaves a space in the middle of a field alone", () => {
    expect(needsCsvQuoting("Harbour Co and Sons")).toBe(false);
  });
});
