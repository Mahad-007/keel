import {
  PROJECT_TAB_LABELS,
  PROJECT_TAB_SUMMARIES,
  type ProjectTab,
} from "@/lib/projects/tabs";

import { EmptyPanel } from "../empty-panel";

/**
 * What a tab shows before the phase that builds it has landed.
 *
 * The important part is the distinction it draws: this section is empty
 * because nothing writes to it yet, not because the project has no scope or no
 * time logged. Those look identical from the outside, and getting them
 * confused is how somebody concludes their data has gone missing.
 *
 * It says what the section will hold rather than apologising, because that is
 * the fact worth having: a reader deciding whether Keel will track something
 * for them is answered by the sentence, not by the absence.
 */
export function UnbuiltTabPanel({ tab }: { tab: ProjectTab }) {
  return (
    <EmptyPanel heading={`${PROJECT_TAB_LABELS[tab]} — not built yet.`}>
      <p>{PROJECT_TAB_SUMMARIES[tab]}</p>
      <p>
        Nothing is stored for it, so there is nothing hidden here — this part
        of the project page arrives with the phase that builds it.
      </p>
    </EmptyPanel>
  );
}
