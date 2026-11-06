import { describe, expect, it } from "vitest";

import {
  csvDocument,
  csvField,
  csvRow,
  downloadFilename,
  FALLBACK_FILENAME,
  needsCsvQuoting,
  startsCsvFormula,
} from "./csv";

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

describe("startsCsvFormula", () => {
  it("spots each sign a spreadsheet evaluates", () => {
    expect(startsCsvFormula("=1+1")).toBe(true);
    expect(startsCsvFormula("+1")).toBe(true);
    expect(startsCsvFormula("-2h on the call")).toBe(true);
    expect(startsCsvFormula("@SUM(A1)")).toBe(true);
  });

  it("spots the leading whitespace that used to get past the check", () => {
    expect(startsCsvFormula("\t=cmd")).toBe(true);
    expect(startsCsvFormula("\r=cmd")).toBe(true);
  });

  it("leaves a sign in the middle of a note alone", () => {
    expect(startsCsvFormula("See =1+1 in the brief")).toBe(false);
    expect(startsCsvFormula("Harbour Co")).toBe(false);
    expect(startsCsvFormula("")).toBe(false);
  });

  it("leaves the columns this app generates alone", () => {
    expect(startsCsvFormula("2026-10-16")).toBe(false);
    expect(startsCsvFormula("90")).toBe(false);
    expect(startsCsvFormula("1.50")).toBe(false);
    expect(startsCsvFormula("Yes")).toBe(false);
  });
});

describe("csvField with a formula in it", () => {
  it("prefixes the field so the cell holds text", () => {
    expect(csvField("=1+1")).toBe("'=1+1");
  });

  it("prefixes and quotes a formula that also holds a comma", () => {
    expect(csvField("=SUM(1,2)")).toBe("\"'=SUM(1,2)\"");
  });

  it("keeps the tab the prefix pushed into the middle of the field", () => {
    expect(csvField("\t=cmd")).toBe("'\t=cmd");
  });

  it("still quotes a carriage return the prefix pushed along", () => {
    expect(csvField("\r=cmd")).toBe("\"'\r=cmd\"");
  });
});

describe("csvRow", () => {
  it("joins the fields with commas", () => {
    expect(csvRow(["2026-10-16", "Harbour Co", "90"])).toBe(
      "2026-10-16,Harbour Co,90",
    );
  });

  it("escapes each field as it goes", () => {
    expect(csvRow(["Harbour Co, Ltd", 'the "rebuild"'])).toBe(
      '"Harbour Co, Ltd","the ""rebuild"""',
    );
  });

  it("writes an empty field as nothing between two commas", () => {
    expect(csvRow(["90", "", "Yes"])).toBe("90,,Yes");
  });

  it("writes a row of one field as that field", () => {
    expect(csvRow(["Note"])).toBe("Note");
  });

  it("writes a row of no fields as an empty line", () => {
    expect(csvRow([])).toBe("");
  });

  it("does not end the row", () => {
    expect(csvRow(["90"])).toBe("90");
  });
});

describe("csvDocument", () => {
  it("ends every row with CRLF, the last one included", () => {
    expect(csvDocument([["a"], ["b"]])).toBe("a\r\nb\r\n");
  });

  it("is empty for no rows at all", () => {
    expect(csvDocument([])).toBe("");
  });

  it("keeps a quoted field's own line break out of the row count", () => {
    const file = csvDocument([
      ["Note"],
      ["Two calls\nand an email"],
      ["One call"],
    ]);

    expect(file).toBe('Note\r\n"Two calls\nand an email"\r\nOne call\r\n');
    expect(file.split("\r\n")).toHaveLength(4);
  });

  it("escapes each row independently", () => {
    expect(csvDocument([["a,b"], ["c"]])).toBe('"a,b"\r\nc\r\n');
  });
});

describe("downloadFilename", () => {
  it("leaves a name built of dates and words alone", () => {
    expect(downloadFilename("keel-time-2026-10-01-to-2026-10-31.csv")).toBe(
      "keel-time-2026-10-01-to-2026-10-31.csv",
    );
  });

  it("replaces a quote that would end the header parameter", () => {
    expect(downloadFilename('a"b.csv')).toBe("a-b.csv");
  });

  it("replaces a CRLF that would end the header", () => {
    expect(downloadFilename("a\r\nSet-Cookie: x=1.csv")).toBe(
      "a-Set-Cookie-x-1.csv",
    );
  });

  it("replaces path separators", () => {
    expect(downloadFilename("../../etc/passwd")).toBe("etc-passwd");
  });

  it("collapses a run of refused characters into one hyphen", () => {
    expect(downloadFilename("a   b.csv")).toBe("a-b.csv");
  });

  it("will not name a hidden file", () => {
    expect(downloadFilename(".csv")).toBe("csv");
  });

  it("will not name a file that reads as an argument", () => {
    expect(downloadFilename("-f.csv")).toBe("f.csv");
  });

  it("falls back when nothing usable is left", () => {
    expect(downloadFilename("..")).toBe(FALLBACK_FILENAME);
    expect(downloadFilename("")).toBe(FALLBACK_FILENAME);
    expect(downloadFilename("   ")).toBe(FALLBACK_FILENAME);
  });
});
