import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { assessProjectCreep } from "@/lib/projects/creep-readings";
import { resolveJoinedRate, type JoinedRate } from "@/lib/rates";
import type { ScopeLine } from "@/lib/scope";
import type { CreepAssessment } from "@/lib/scope-creep";
import { creepThresholds } from "@/lib/thresholds/creep";
import {
  resolveJoinedThresholds,
  type JoinedThresholds,
} from "@/lib/thresholds/resolve";
import type { LoggedTotals } from "@/lib/time/rollup";

import { riskBand, type RiskBand } from "./band";

/**
 * One line of the portfolio: a project, what its hours came to, and the
 * verdict that places it.
 *
 * Every figure on this row is reached the way the project page reaches it —
 * `resolveJoinedRate` for what an hour is worth, `resolveJoinedThresholds` for
 * what counts as too far, `assessProjectCreep` for the verdict. That is the
 * whole discipline of this module. A portfolio that ranked projects by a
 * second opinion about any of those would be a page that disagrees with the
 * banner a reader lands on when they click the row, and the reader would have
 * no way to tell which of the two was lying.
 */

/**
 * The part of a project a portfolio row reads.
 *
 * Structural, like `JoinedRate` and `JoinedThresholds` which it is built from,
 * so it is satisfied by the row `listProjectsWithClient` produces and by a
 * literal in a test. The alternative — taking `ProjectWithClient` — would
 * import a query's result type into the pure half of the app and make every
 * test build eighteen columns to rank two projects.
 *
 * The two joined halves carry everything the arithmetic needs: the project's
 * rate override and its client's default, the project's five thresholds and
 * its client's. The four fields of its own are what the row is *labelled* with
 * — which project, whose, and the price the burn is a share of.
 *
 * `clientArchivedAt` is here because archiving a client does not close their
 * projects. An engagement for a client who is off the books is still running
 * and still worth ranking, and the row has to be able to say so rather than
 * showing a name that reads live.
 */
export type HealthProject = JoinedRate &
  JoinedThresholds & {
    readonly id: string;
    readonly name: string;
    /** Whose engagement it is, for the link to the client. */
    readonly clientId: string;
    readonly clientName: string;
    /** When the client was archived, or null while they are on the books. */
    readonly clientArchivedAt: string | null;
    /** What the engagement was agreed for, in cents. */
    readonly contractValueCents: number;
  };

/**
 * One project, assessed, with everything the page needs to print and rank it.
 *
 * Four fields, and each is read at a different distance. `project` is what the
 * row is called. `burn` is what the hours came to, which is the figure a
 * reader asks for the moment they disagree with the verdict. `assessment` is
 * the verdict and its working. `band` is where the row sits in the order.
 *
 * `band` is carried rather than derived at the comparison, for the reason
 * `CreepAssessment` carries its shares: it is read twice — once to sort and
 * once to label — and two derivations is how a row comes to be sorted into one
 * band and printed as another.
 */
export type PortfolioRow = {
  /** The project, as the join read it. */
  readonly project: HealthProject;
  /** What the hours came to against the price, at the resolved rate. */
  readonly burn: BurnSummary;
  /** The verdict, why, what it could not see, and the figures behind it. */
  readonly assessment: CreepAssessment;
  /** Where the row sits in the order. */
  readonly band: RiskBand;
};

/**
 * Assess one project for the portfolio: the join, its totals, its scope list.
 *
 * The three reads the page makes, turned into one row. Nothing here decides
 * anything — the rate, the thresholds and the verdict all come from the
 * modules that own them — and that is the point: this function exists so the
 * three are put together in one place, by name, rather than at a call site
 * where the two resolutions could be handed each other's row.
 *
 * `totals` rather than a burn summary, because the price and the rate are on
 * the project and the summary is where the three meet. A caller that built the
 * summary itself would be a caller free to value an engagement at its client's
 * rate while the project overrode it.
 */
export function portfolioRow(
  project: HealthProject,
  totals: LoggedTotals,
  lines: readonly ScopeLine[],
): PortfolioRow {
  const burn = summariseBurn(
    totals,
    project.contractValueCents,
    resolveJoinedRate(project),
  );
  const assessment = assessProjectCreep(
    burn,
    lines,
    creepThresholds(resolveJoinedThresholds(project)),
  );

  return { project, burn, assessment, band: riskBand(assessment.health) };
}
