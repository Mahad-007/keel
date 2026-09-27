import { projectTabHref } from "@/lib/projects/detail";
import {
  PROJECT_TABS,
  PROJECT_TAB_LABELS,
  type ProjectTab,
} from "@/lib/projects/tabs";

import { TabBar, TabLink } from "../tab-bar";

/**
 * The sections of a project page, as a row of tabs.
 *
 * Every tab is shown from the start, including the four that later phases
 * fill in. Hiding them until they work would make the page grow a new control
 * every few weeks and leave a reader with no idea what Keel is going to know
 * about their project; showing them says what the shape of the thing is, and
 * each empty one explains itself when opened.
 */
export function ProjectTabs({
  projectId,
  current,
}: {
  projectId: string;
  current: ProjectTab;
}) {
  return (
    <TabBar label="Project sections">
      {PROJECT_TABS.map((tab) => (
        <TabLink
          key={tab}
          href={projectTabHref(projectId, tab)}
          current={tab === current}
        >
          {PROJECT_TAB_LABELS[tab]}
        </TabLink>
      ))}
    </TabBar>
  );
}
