import type { BurnSummary } from "@/lib/burn";
import { formatCents } from "@/lib/money";

import { hasContractValue, NO_CONTRACT_VALUE_LABEL } from "./detail";
import type { PanelFigure } from "./figure";

/**
 * The words a burn summary is read in.
 *
 * `lib/burn.ts` works out what a project has consumed of what it was agreed
 * for; nothing in it knows what a figure is called, when a figure is worth
 * showing, or what a reader should conclude from it. That is this file: a
 * label, a value, and — where the number alone would mislead — the sentence
 * that says how to read it.
 *
 * The sentences live here rather than in the panel for the reason the scope
 * summary's and the rollup's do: deciding that nought burned against eighty
 * hours logged means a missing rate rather than a cheap project is a rule
 * about the data, and a rule is testable where JSX is not.
 *
 * This is the most consequential panel in the app so far. "You have burned
 * 112% of this contract" is a sentence somebody takes into a difficult
 * conversation, and the figure behind it is a product of three columns any
 * one of which may be empty. So every value here either says something the
 * arithmetic supports or says plainly that it cannot — and the note under it
 * is the working, so a reader can check the claim rather than having to
 * believe it.
 */

/**
 * Whether there is a burn worth showing at all.
 *
 * Two ways to have one. Time logged is the obvious one: hours have gone in,
 * and what they came to is the question. A contract value with nothing logged
 * is the other, and it is worth a panel too — "nothing burned, the whole
 * $5,000.00 still there" is the opening state of every engagement, and a
 * panel that appeared only once somebody had logged against it would leave a
 * reader wondering where the figure went.
 *
 * Neither means nothing to say. A project with no price and no hours is a row
 * somebody has just created, and four figures reading "Not set" and "None
 * yet" above it would be a panel reporting that the project is new.
 *
 * Here rather than in the panel, for the reason the sentences are: it is a
 * fact about the burn rather than about one tab, and the panel's most
 * consequential decision — render nothing at all — is testable where JSX is
 * not.
 */
export function hasBurnToShow(summary: BurnSummary): boolean {
  return summary.entryCount > 0 || summary.contractedCents !== 0;
}

/**
 * Why there is nothing for the figures below to be measured against, when
 * there is not.
 *
 * The one thing a reader can do about it: the price is a field on the edit
 * form, and until it is filled in the remaining figure and the percentage are
 * both about half a comparison. Said once here rather than repeated under
 * each of them, because it is one missing fact rather than three.
 *
 * Null when a price is set, which is almost always. An amount somebody agreed
 * needs no explanation — it is the one figure on this panel that was typed in
 * rather than derived.
 */
export function describeContracted(summary: BurnSummary): string | null {
  if (hasContractValue(summary.contractedCents)) return null;
  return "No contract value is set on this project, so there is nothing for the hours to be measured against. It is a field on the edit form.";
}

/**
 * What the engagement was agreed for, as the first line of the panel.
 *
 * First, because every figure under it is a part of it or a judgement on it,
 * and none of them means anything until a reader knows what the agreement
 * was. It is also the only figure here that somebody typed in — the other
 * three are arithmetic over it — and a panel of derived numbers should open
 * with the one that was agreed.
 *
 * "Contracted" rather than "Contract value", which is what the header calls
 * it. The header is stating a fact about the project; this is one of four
 * figures in a column, and the shorter word keeps it reading as a quantity
 * beside "Burned" and "Remaining" rather than as a repeat of the heading
 * above it.
 */
export function contractedFigure(summary: BurnSummary): PanelFigure {
  return {
    label: "Contracted",
    value: hasContractValue(summary.contractedCents)
      ? formatCents(summary.contractedCents)
      : NO_CONTRACT_VALUE_LABEL,
    note: describeContracted(summary),
  };
}
