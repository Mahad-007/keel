/**
 * The look every form control shares, in one place so an input and a textarea
 * on the same form cannot drift into two different boxes.
 *
 * The invalid state changes the border and nothing else. Colour alone is not
 * the signal — `aria-invalid` and the message below the control are — so this
 * is allowed to be quiet.
 */
const BASE =
  "w-full rounded border bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-700";

const BORDER = {
  valid: "border-zinc-300 dark:border-zinc-700",
  invalid: "border-red-500 dark:border-red-500",
} as const;

export function controlClassName(invalid: boolean): string {
  return `${BASE} ${invalid ? BORDER.invalid : BORDER.valid}`;
}
