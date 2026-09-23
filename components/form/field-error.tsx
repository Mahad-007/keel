/**
 * What is wrong with one field, in a sentence, beneath the control it belongs
 * to.
 *
 * It carries an id because the control points at it with `aria-describedby`:
 * the message is read out with the input rather than sitting somewhere on the
 * page a screen reader may never reach. That wiring is the whole reason this
 * is a component and not a paragraph typed inline.
 */
export function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="text-sm text-red-700 dark:text-red-400">
      {children}
    </p>
  );
}
