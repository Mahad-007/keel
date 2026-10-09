import { TextAreaField, TextField } from "@/components/form";
import {
  TEMPLATE_FIELD_LIMITS,
  TEMPLATE_FIELD_SCOPE,
  type TemplateFormState,
} from "@/lib/templates/form";

/**
 * The two things a template is: what to call it, and what it is for.
 *
 * The name is prefilled with the project's, so the common case is a press
 * rather than a sentence to compose — which is why the hint tells the reader
 * they can change it rather than asking them to fill it in.
 *
 * The description earns its place by being the only thing that can say *when*
 * to reach for this template. "Website build" and "Website build (fixed fee)"
 * are two names a person will guess between in six months; "for clients who
 * supply their own copy" is the sentence that settles it.
 */
export function TemplateFields({ state }: { state: TemplateFormState }) {
  return (
    <>
      <TextField
        name="name"
        label="Template name"
        hint="What you will pick it out of a list by. Prefilled with this project's name — change it to something you will recognise on a different engagement."
        error={state.errors.name}
        defaultValue={state.fields.name}
        maxLength={TEMPLATE_FIELD_LIMITS.name}
        scope={TEMPLATE_FIELD_SCOPE}
      />
      <TextAreaField
        name="description"
        label="When to use it"
        hint="Optional. What kind of engagement this scope fits, which is the thing a name cannot say."
        rows={2}
        error={state.errors.description}
        defaultValue={state.fields.description}
        maxLength={TEMPLATE_FIELD_LIMITS.description}
        scope={TEMPLATE_FIELD_SCOPE}
      />
    </>
  );
}
