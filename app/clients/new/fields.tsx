import type { ReactNode } from "react";

/**
 * The labelled inputs the client form is built from. Presentational and
 * server-rendered: they hold no state, they just wire a label, a hint, and an
 * error message to one input and say so in the markup.
 *
 * Day 005 lifts these into `components/form/` once a second form exists to
 * share them. Until then they live beside the only form that uses them.
 *
 * The error is announced, not merely coloured: `aria-invalid` and
 * `aria-describedby` mean a screen reader reaches the input already knowing
 * what is wrong with it, and the message is a sentence rather than a red ring.
 */

type FieldShellProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

function FieldShell({ name, label, hint, error, children }: FieldShellProps) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: error !== undefined })}
      {error ? (
        <p
          id={errorId}
          className="text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-sm text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASSES =
  "w-full rounded border bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-700";

function borderClasses(invalid: boolean): string {
  return invalid
    ? "border-red-500 dark:border-red-500"
    : "border-zinc-300 dark:border-zinc-700";
}

export type TextFieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  type?: "text" | "email";
  inputMode?: "text" | "email" | "decimal";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
};

export function TextField({
  name,
  label,
  hint,
  error,
  defaultValue,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  maxLength,
}: TextFieldProps) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          defaultValue={defaultValue}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${CONTROL_CLASSES} ${borderClasses(invalid)}`}
        />
      )}
    </FieldShell>
  );
}

export type TextAreaFieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
};

export function TextAreaField({
  name,
  label,
  hint,
  error,
  defaultValue,
  rows = 4,
  maxLength,
}: TextAreaFieldProps) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          name={name}
          rows={rows}
          maxLength={maxLength}
          defaultValue={defaultValue}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${CONTROL_CLASSES} ${borderClasses(invalid)}`}
        />
      )}
    </FieldShell>
  );
}
