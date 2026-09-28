import { EmptyPanel } from "../empty-panel";

/**
 * There is nobody to file a project under.
 *
 * The form is not rendered at all rather than rendered with an empty picker: a
 * picker with nothing in it is a form that cannot be completed, and offering
 * one asks the reader to work out why. The way out is the client book, which is
 * also the only way out — every project hangs off a client.
 */
export function NoClientsToPick() {
  return (
    <EmptyPanel
      heading="No clients to file a project under."
      action={{ href: "/clients/new", label: "Add a client" }}
    >
      <p>
        Every project belongs to one client, and the client is where the default
        rate comes from — so the client comes first.
      </p>
      <p>
        If the client you want is archived, restore them from the archived list
        and they will appear here.
      </p>
    </EmptyPanel>
  );
}
