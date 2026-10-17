import { describeField } from "./describe";
import { FieldError } from "./field-error";
import { FieldHint } from "./field-hint";

/**
 * A single tick box, with its label beside it rather than above it.
 *
 * The only control in the set that does not go through `Field`, and the reason
 * is the layout: every other field is a label with a box under it, and a
 * checkbox is a box with its label to the right, because the label *is* the
 * question and the box is the answer. Stacking them would leave a label
 * floating above a 16-pixel square with nothing to say which it belongs to.
 *
 * The wiring is the same, though, and comes from the same place:
 * `describeField` derives the ids, so the label points at the box and the box
 * points at its hint and its error exactly as every other field does.
 *
 * `value` is required rather than defaulted to the browser's `on`, because a
 * checkbox submits nothing at all when it is unticked — so the value is the
 * only thing the server has to recognise, and a form that relies on a default
 * nobody wrote down is a form that silently stops ticking.
 */
export type CheckboxFieldProps = {
  name: string;
  /** The question, read as a statement: "This time is chargeable". */
  label: string;
  hint?: string;
  error?: string;
  /** What the box submits when it is ticked. */
  value: string;
  defaultChecked?: boolean;
  /**
   * Which of several forms on the page this field belongs to, so two forms
   * asking for the same thing do not render two controls with one id. Omitted
   * on a page with one form — see `fieldId`.
   */
  scope?: string;
};

export function CheckboxField({
  name,
  label,
  hint,
  error,
  value,
  defaultChecked,
  scope,
}: CheckboxFieldProps) {
  const description = describeField({ name, hint, error, scope });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          id={description.id}
          name={name}
          type="checkbox"
          value={value}
          defaultChecked={defaultChecked}
          aria-invalid={description.invalid || undefined}
          aria-describedby={description.describedBy}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:focus:ring-zinc-700"
        />
        <label
          htmlFor={description.id}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          {label}
        </label>
      </div>
      {description.error === null ? null : (
        <FieldError id={description.error.id}>
          {description.error.text}
        </FieldError>
      )}
      {description.hint === null ? null : (
        <FieldHint id={description.hint.id}>{description.hint.text}</FieldHint>
      )}
    </div>
  );
}
