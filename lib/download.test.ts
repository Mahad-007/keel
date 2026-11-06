import { describe, expect, it } from "vitest";

import {
  attachmentDisposition,
  downloadFilename,
  FALLBACK_FILENAME,
} from "./download";

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

  it("falls back to a name that claims no format", () => {
    expect(FALLBACK_FILENAME).not.toContain(".");
  });
});

describe("attachmentDisposition", () => {
  it("asks the browser to save the file under the name", () => {
    expect(attachmentDisposition("keel-time-all-time.csv")).toBe(
      'attachment; filename="keel-time-all-time.csv"',
    );
  });

  it("cannot be made to hold a second parameter", () => {
    expect(attachmentDisposition('x.csv"; filename*=utf-8\'\'y')).toBe(
      'attachment; filename="x.csv-filename-utf-8-y"',
    );
  });

  it("names the fallback when the name cleans away to nothing", () => {
    expect(attachmentDisposition("...")).toBe(
      `attachment; filename="${FALLBACK_FILENAME}"`,
    );
  });
});
