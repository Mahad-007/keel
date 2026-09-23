/**
 * The form primitives, in one import.
 *
 * Every form in the app is built from this set, and the set is deliberately
 * small: a label bound to its control, a message under it, a summary at the
 * top, a button that knows it has been pressed. A form that needs something
 * not in here should add it here, not next to the page that wanted it.
 */

export { Field, type FieldProps } from "./field";
export { FieldError } from "./field-error";
export { FieldHint } from "./field-hint";
export { FormSummary } from "./form-summary";
export { SubmitButton, type SubmitButtonProps } from "./submit-button";
export { TextAreaField, type TextAreaFieldProps } from "./textarea-field";
export { TextField, type TextFieldProps } from "./text-field";
export { useFirstErrorFocus } from "./use-first-error-focus";
export { useFormPending } from "./use-form-pending";

export { describeField, type FieldDescription } from "./describe";
export { fieldErrorId, fieldHintId, fieldId } from "./ids";
