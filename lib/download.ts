/**
 * Serving a file rather than a page: what it is called, and the headers that
 * make a browser save it.
 *
 * None of this is about CSV. A filename allowlist and a `Content-Disposition`
 * are facts about HTTP downloads, and the roadmap has two more of them coming
 * — an invoice as CSV and JSON, and a JSON dump of everything. The header
 * reasoning below is the kind that protects one endpoint and gets
 * re-implemented, slightly differently, for the next.
 */

/**
 * What a download is called when nothing usable is left of its name.
 *
 * No extension, because this module does not know the format. It is also not
 * reachable from any name this app builds — the filename builders produce
 * dates and hyphenated words — and exists so the header is well formed
 * whatever it is handed.
 */
export const FALLBACK_FILENAME = "download";

/** Everything a filename is not allowed to hold, collapsed to one hyphen. */
const NOT_IN_FILENAME = /[^A-Za-z0-9._-]+/g;

/** Dots and hyphens at either end, which name a hidden file or no file. */
const EDGE_PUNCTUATION = /^[.-]+|[.-]+$/g;

/**
 * A filename cut down to the characters it is safe to interpolate into a
 * response header.
 *
 * An allowlist rather than a list of things to strip, because this value goes
 * into `Content-Disposition` between two quotes: a name holding a quote ends
 * the parameter early, a semicolon adds a parameter nobody wrote, and a CRLF
 * ends the header and starts whatever follows it. Naming the characters a
 * filename needs makes all three impossible rather than merely unlikely —
 * which is the right standard for a header, even though every name this app
 * builds is already dates and plain words.
 *
 * Leading dots and hyphens come off at both ends. A download called `.csv` is
 * a hidden file on the reader's machine, and one called `-f` is an argument to
 * whatever they type next.
 *
 * Non-ASCII goes with them, which is a real loss and the reason the names are
 * built from dates rather than from a client's name: carrying a name through
 * properly means the RFC 5987 `filename*` form as well as this one, and a
 * second encoding to get wrong for a filename nobody reads twice.
 */
export function downloadFilename(name: string): string {
  const cleaned = name
    .replace(NOT_IN_FILENAME, "-")
    .replace(EDGE_PUNCTUATION, "");
  return cleaned === "" ? FALLBACK_FILENAME : cleaned;
}

/**
 * The `Content-Disposition` for a download: save it, under this name.
 *
 * `attachment` rather than `inline`, which is the difference between a file in
 * the reader's downloads folder and a wall of commas where the page they came
 * from used to be. It is also what makes the filename mean anything — a
 * browser showing a document inline has no use for one.
 */
export function attachmentDisposition(name: string): string {
  return `attachment; filename="${downloadFilename(name)}"`;
}
