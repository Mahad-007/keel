/**
 * The button that submits a form.
 *
 * Two looks, because a page can hold two submit buttons and they must not
 * read as equals: `primary` is the thing the page is for, `secondary` is the
 * one sitting next to it that the user should have to mean.
 */
const VARIANTS = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500",
} as const;

export type SubmitButtonVariant = keyof typeof VARIANTS;

export type SubmitButtonProps = {
  children: string;
  variant?: SubmitButtonVariant;
};

export function SubmitButton({ children, variant = "primary" }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}
