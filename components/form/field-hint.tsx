/**
 * The sentence under a field explaining what belongs in it — what "Default
 * rate" is per, or that "Company" is optional.
 *
 * Quieter than the error and, like it, referenced by the control rather than
 * merely adjacent to it, so the advice arrives before the field is filled in
 * wrongly rather than after.
 */
export function FieldHint({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="text-sm text-zinc-500 dark:text-zinc-400">
      {children}
    </p>
  );
}
