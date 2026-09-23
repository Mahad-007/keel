/**
 * How one control is wired to the text around it.
 *
 * A field is not accessible because it is red. It is accessible because the
 * control carries `aria-invalid` and points at the paragraph saying what is
 * wrong, so a screen reader arrives at the input already knowing. Working
 * that out is arithmetic on a few strings, and doing it here rather than
 * inside the JSX is what makes it testable.
 */

import { readableMessage } from "@/lib/forms/message";

import { fieldErrorId, fieldHintId, fieldId } from "./ids";

/**
 * A message and the id the control announces it by. They travel together
 * because neither is any use alone: an id with no message renders an empty
 * paragraph, and a message with no id is text a screen reader never reaches.
 */
export type FieldMessage = {
  readonly id: string;
  readonly text: string;
};

export type FieldDescription = {
  /** The control's own id, the one the label points at. */
  readonly id: string;
  /** Null when the field has no hint worth rendering. */
  readonly hint: FieldMessage | null;
  /** Null when the field has nothing wrong with it. */
  readonly error: FieldMessage | null;
  /** `aria-describedby`, or undefined when there is nothing to describe. */
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
};

export type FieldDescriptionInput = {
  name: string;
  hint?: string;
  error?: string;
};

/**
 * A message worth rendering, under the id that announces it. An empty or
 * whitespace-only string reaches here whenever a caller writes
 * `error={state.errors[name] ?? ""}`, and treating it as a message would put a
 * red border on a control with nothing beneath it to say why — the one state a
 * form must never be in. `readableMessage` is the same rule the form summary
 * counts by, so the two cannot disagree about whether a field is in trouble.
 */
function message(text: string | undefined, id: string): FieldMessage | null {
  const readable = readableMessage(text);
  return readable === null ? null : { id, text: readable };
}

export function describeField({
  name,
  hint,
  error,
}: FieldDescriptionInput): FieldDescription {
  const hintMessage = message(hint, fieldHintId(name));
  const errorMessage = message(error, fieldErrorId(name));

  // The error comes first: a screen reader reads the description in order,
  // and the problem matters more than the advice that failed to prevent it.
  const described = [errorMessage, hintMessage].filter((part) => part !== null);

  return {
    id: fieldId(name),
    hint: hintMessage,
    error: errorMessage,
    describedBy:
      described.length === 0
        ? undefined
        : described.map((part) => part.id).join(" "),
    invalid: errorMessage !== null,
  };
}
