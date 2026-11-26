import { TextField } from "@/components/form";
import {
  THRESHOLD_FIELD_NAMES,
  type ThresholdFieldName,
  type ThresholdFormFields,
} from "@/lib/forms/threshold";
import type { FieldErrors } from "@/lib/forms/result";
import {
  thresholdFieldHint,
  type ThresholdInheritance,
} from "@/lib/thresholds/describe";
import { THRESHOLD_SETTINGS } from "@/lib/thresholds/settings";

/**
 * The five boxes that move the figures a project is flagged at, on whichever
 * form is setting them.
 *
 * One component for both rows, because the fields are identical and the only
 * difference is what an empty box means — a client's falls to Keel's default, a
 * project's falls to its client first. Two copies would be two places to add
 * the sixth setting, and the one that got missed would silently stop saving:
 * a field nothing renders submits nothing, which reads as a blank box, which is
 * a legal answer meaning "inherit".
 *
 * A `fieldset` rather than five loose fields, so the group has a name a screen
 * reader announces before each label. Without it, "Contract nearly spent" on
 * the project form and the same words on the client form are two unrelated
 * boxes rather than one setting and its override.
 */
export function ThresholdFields({
  fields,
  errors,
  inherits,
}: {
  /** What is in the boxes: the stored settings, or what was just submitted. */
  fields: ThresholdFormFields;
  /**
   * The messages, keyed by setting. Wider than this component needs — a form
   * state carries every field's errors — which is deliberate: handing it the
   * whole thing is what keeps the message under the box it belongs to.
   */
  errors: FieldErrors<ThresholdFieldName>;
  /** Which rung an empty box falls to, which is the one thing the two differ by. */
  inherits: ThresholdInheritance;
}) {
  return (
    <fieldset className="mt-3 flex flex-col gap-5 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Thresholds
      </legend>
      {/*
        What the group is, and that it can be skipped. A form that opened with
        five numbers and no sentence would read as five decisions nobody can
        make, when the honest answer for most engagements is that the figures
        this repo ships are fine.

        It does not restate what an empty box falls back to. Each hint says
        that, beside the box it is about and with that setting's own figure in
        it, and a paragraph saying it a sixth time would be the sentence a
        reader learns to skip — along with the five that matter.
      */}
      <p className="max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {INTRO[inherits]}
      </p>
      {THRESHOLD_FIELD_NAMES.map((key) => (
        <TextField
          key={key}
          name={key}
          label={THRESHOLD_SETTINGS[key].label}
          hint={thresholdFieldHint(key, inherits)}
          inputMode="numeric"
          /*
            The figure in force when the box is left empty, but only where this
            form knows it. A client's blank box falls to the default, so the
            default is what the grey text is promising; a project's falls to
            whichever client the picker is on, which this form cannot read and
            which can change under it — and a placeholder quoting the default
            there would be a figure the project would not actually be judged by.
          */
          placeholder={
            inherits === "default"
              ? String(THRESHOLD_SETTINGS[key].fallback)
              : undefined
          }
          defaultValue={fields[key]}
          error={errors[key]}
        />
      ))}
    </fieldset>
  );
}

/**
 * What the group is for, said once above the boxes.
 *
 * Two sentences rather than one shared with a clause swapped in, because the
 * two forms are answering different questions. A client's thresholds are the
 * tolerance of an engagement — agreed with them, applying to everything filed
 * under them — and a project's are the exception for the one job that is not
 * like the others.
 */
const INTRO: Record<ThresholdInheritance, string> = {
  default:
    "The figures every project for this client is flagged at. Fill one in only where you have agreed something other than what the box says below it.",
  client:
    "The figures this project alone is flagged at, for the engagement that is not like the client's others. Most projects need none of them.",
};
