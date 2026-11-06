import { describe, expect, it } from "vitest";

import { csvField, needsCsvQuoting } from "./csv";

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

describe("csvField", () => {
  it("hands ordinary text back untouched", () => {
    expect(csvField("Harbour Co")).toBe("Harbour Co");
  });

  it("wraps a field holding the separator", () => {
    expect(csvField("Design, build")).toBe('"Design, build"');
  });

  it("doubles a quote and wraps the field round it", () => {
    expect(csvField('Called it "the rebuild"')).toBe(
      '"Called it ""the rebuild"""',
    );
  });

  it("doubles a field that is nothing but a quote", () => {
    expect(csvField('"')).toBe('""""');
  });

  it("keeps a note's line breaks inside the quotes", () => {
    expect(csvField("Two calls\nand an email")).toBe('"Two calls\nand an email"');
  });

  it("keeps a Windows line ending as it was typed", () => {
    expect(csvField("Two calls\r\nand an email")).toBe(
      '"Two calls\r\nand an email"',
    );
  });

  it("keeps the spaces round a field it had to quote", () => {
    expect(csvField(" Harbour Co ")).toBe('" Harbour Co "');
  });
});
