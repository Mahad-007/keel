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
  /** Whether this client is off the books. */
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
 * One client as one option, with both the flag and the label read off the row.
 *
 * Deriving them rather than setting `archived: false` for the list and true for
 * the kept client means an option cannot claim to be active because of which
 * argument it arrived through. Today the archive is only ever reached through
 * `current`, but `listArchivedClients` exists, and the first caller to hand
 * those rows over as the list should get options that say so.
 */
function toOption(client: Client): ClientOption {
  const archived = client.archivedAt !== null;
  const label = clientOptionLabel(client);
  return {
    id: client.id,
    // Said in the option itself: a picker collapses to one line when it is
    // closed, and that line is all a reader sees of the choice they kept.
    label: archived ? `${label} (archived)` : label,
    archived,
  };
}

/**
 * The options a project form offers, in the order the client list is already
 * read in — alphabetical. A picker sorted differently from the list it stands
 * for is a picker people scroll twice.
 *
 * `current` is the client an existing project is already on, and it is here
 * because archiving a client does not touch their projects: editing one of
 * those projects would otherwise find its own client missing from the picker,
 * and the browser would quietly select whoever happens to be first. Saving the
 * contract value would then reassign the project. So the client is offered,
 * last and labelled, rather than left out.
 */
export function clientOptions(
  clients: readonly Client[],
  current: Client | null = null,
): ClientOption[] {
  const options = clients.map((client) => toOption(client));

  if (current === null || options.some((option) => option.id === current.id)) {
    return options;
  }

  return [...options, toOption(current)];
}

/**
 * The sentence a picker needs when one of its options is a client who is no
 * longer on the books, or null when none of them is.
 *
 * Without it the "(archived)" option is a puzzle: the reader knows the client
 * book does not list that client, and here they are in a list of clients. The
 * answer is that the project is already theirs, and that is worth a sentence
 * rather than leaving someone to conclude the archive is leaking.
 */
export function describeArchivedOption(
  options: readonly ClientOption[],
): string | null {
  if (!options.some((option) => option.archived)) return null;
  return "One option is an archived client, offered because this project is already filed under them; moving it away takes them off the list.";
}
