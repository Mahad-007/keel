import { fieldErrorId, fieldHintId, fieldId } from "./ids";

/**
 * How one control is wired to the text around it.
 *
 * A field is not accessible because it is red. It is accessible because the
 * control carries `aria-invalid` and points at the paragraph saying what is
 * wrong, so a screen reader arrives at the input already knowing. Working
 * that out is arithmetic on three strings, and doing it here rather than
 * inside the JSX is what makes it testable.
 */
export type FieldDescription = {
  /** The control's own id, the one the label points at. */
  readonly id: string;
  /** Set only when there is a hint to render. */
  readonly hintId: string | undefined;
  /** Set only when there is an error to render. */
  readonly errorId: string | undefined;
  /** `aria-describedby`, or undefined when there is nothing to describe. */
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
};

export type FieldDescriptionInput = {
  name: string;
  hint?: string;
  error?: string;
};

export function describeField({
  name,
  hint,
  error,
}: FieldDescriptionInput): FieldDescription {
  const hintId = hint === undefined ? undefined : fieldHintId(name);
  const errorId = error === undefined ? undefined : fieldErrorId(name);

  // The error comes first: a screen reader reads the description in order,
  // and the problem matters more than the advice that failed to prevent it.
  const described = [errorId, hintId].filter((id) => id !== undefined);

  return {
    id: fieldId(name),
    hintId,
    errorId,
    describedBy: described.length === 0 ? undefined : described.join(" "),
    invalid: errorId !== undefined,
  };
}
