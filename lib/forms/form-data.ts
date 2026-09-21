/**
 * Reading a submitted form into plain strings, before any validation.
 *
 * `FormData.get` returns `string | File | null`, and a server action has to
 * cope with all three: a field the browser never sent, and a file entry posted
 * to a name the form expects text at. Both read as empty rather than throwing
 * or reaching a validator as a `File`.
 */

/** Textareas submit CRLF. Storing both line endings makes every later
 * comparison — diffing, length, equality — depend on which browser typed it. */
function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return normalizeNewlines(value);
}

/** The whole form as strings, keyed by field name, ready to validate. */
export function readFields<K extends string>(
  formData: FormData,
  names: readonly K[],
): Record<K, string> {
  const fields = {} as Record<K, string>;
  for (const name of names) {
    fields[name] = readField(formData, name);
  }
  return fields;
}
