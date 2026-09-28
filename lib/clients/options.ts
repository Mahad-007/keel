import type { Client } from "@/lib/db/schema";

/**
 * The clients a project form offers to hang a project off.
 *
 * A picker is not the client list: it has one line per client and no columns,
 * so everything that tells two clients apart has to fit in that line. Working
 * out what that line says is arithmetic on a couple of strings, and doing it
 * here rather than inside the JSX is what makes it testable.
 */

export type ClientOption = {
  readonly id: string;
  /** What the option reads as, already disambiguated. */
  readonly label: string;
  /**
   * Whether this client is off the books. Only ever true of the one a project
   * is already on — see `clientOptions`.
   */
  readonly archived: boolean;
};

/**
 * One client on one line. The company follows the name when there is one and
 * it is not simply the name again, because two freelance clients called
 * "James" are two rows in the list and one indistinguishable pair in a picker.
 */
export function clientOptionLabel(client: Client): string {
  const company = client.company?.trim() ?? "";
  if (company === "" || company === client.name.trim()) return client.name;
  return `${client.name} — ${company}`;
}

/**
 * The options a project form offers, in the order the client list is already
 * read in — alphabetical. A picker sorted differently from the list it stands
 * for is a picker people scroll twice.
 */
export function clientOptions(clients: readonly Client[]): ClientOption[] {
  return clients.map((client) => ({
    id: client.id,
    label: clientOptionLabel(client),
    archived: false,
  }));
}
