import { EmptyPanel } from "@/components/empty-panel";

/**
 * A project with no deliverables on it yet.
 *
 * It spends its words on why the list is worth filling in, because that is
 * the question a reader actually has. Scope is the one thing Keel cannot
 * derive from anything else — the contract value comes off the project, the
 * hours come off the clock, but what was promised only exists if somebody
 * writes it down, and every number in Phase 2 and most of Phase 4 is measured
 * against it.
 *
 * No link out: the two things that fix this are both directly underneath —
 * the add line, and the box a list agreed elsewhere is pasted into — so
 * sending the reader somewhere would be sending them away from both.
 */
export function NoDeliverables() {
  return (
    <EmptyPanel heading="No scope agreed yet.">
      <p>
        A deliverable is one thing you promised to hand over. Listing them is
        what turns a contract value into something you can measure against: a
        project without a scope list can only tell you it went over, while one
        with a list can tell you which part of the work ate it.
      </p>
      <p>
        Each line carries an estimate in hours. Those add up to what you
        thought the job was; the time you log against them becomes what it
        actually was, and the gap between the two is scope creep — invisible
        until the scope is written down.
      </p>
      <p>
        Add the first line below. A title on its own is enough to start with,
        and the estimate can follow once you have thought about it — or, if the
        list already exists in a proposal or a spreadsheet, paste the whole of
        it into the import box further down and check it before it lands.
      </p>
    </EmptyPanel>
  );
}
