import { invalid, valid, type FieldResult } from "./result";
import { optionalText } from "./text";

/**
 * Email validation only tries to catch a typo, not to prove deliverability —
 * that is what sending a message does. The check is therefore deliberately
 * loose: something before an `@`, a dotted domain after it, and no spaces.
 *
 * The address is trimmed but not lower-cased. The domain is case-insensitive
 * but the local part is not, and quietly rewriting what someone typed is a
 * worse failure than storing a capital letter.
 */

/** RFC 5321's limit on a complete address. */
export const EMAIL_MAX_LENGTH = 254;

const SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function optionalEmail(
  value: string,
  label = "Email",
): FieldResult<string | null> {
  const text = optionalText(value, { label, max: EMAIL_MAX_LENGTH });
  if (!text.ok || text.value === null) return text;

  if (!SHAPE.test(text.value)) {
    return invalid(`${label} does not look like an email address.`);
  }
  return valid(text.value);
}
