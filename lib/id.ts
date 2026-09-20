/**
 * Ids are generated in the application, never by the database. A row can then
 * be built, referenced by other rows, and logged before it is ever written,
 * and an insert needs no round trip to learn what it just created.
 *
 * Shape is `<prefix>_<8 chars of base36 milliseconds><12 random base36 chars>`.
 * The time component makes ids sort roughly by creation order, which keeps
 * list queries and debugging sane; the random tail is what makes them unique.
 */

const TIME_LENGTH = 8;
const RANDOM_LENGTH = 12;

/** 36 * 7 = 252. Bytes at or above it are redrawn so the alphabet stays even. */
const CEILING = 252;

function randomBase36(length: number): string {
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length - out.length);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= CEILING) continue;
      out += (byte % 36).toString(36);
    }
  }
  return out;
}

/**
 * `newId("cli")` → `cli_lyq3k2p0f3n8x1c4b7`. The prefix is optional but worth
 * passing: an id in a log line should say what it points at.
 */
export function newId(prefix?: string): string {
  if (prefix !== undefined && !/^[a-z]+$/.test(prefix)) {
    throw new Error(`id prefix must be lowercase letters: ${prefix}`);
  }
  const time = Date.now().toString(36).padStart(TIME_LENGTH, "0");
  const id = time + randomBase36(RANDOM_LENGTH);
  return prefix ? `${prefix}_${id}` : id;
}
