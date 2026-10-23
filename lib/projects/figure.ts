/**
 * One line of a figures panel on the project page: what it is called, what it
 * says, and the caveat a reader needs to read it correctly.
 *
 * Its own file because two panels build these now — the scope summary and the
 * time rollup — and a shape named after the first of them would have the
 * second importing "scope" to describe a figure about hours.
 *
 * A value that is always a string, never a number, because half of these are
 * not numbers. "Not estimated" is the honest reading of an unsized list and
 * "None yet" of a line nobody has logged against; a panel that had to choose
 * between a figure and a sentence per row would make that choice on every row.
 *
 * The note is null rather than empty when there is nothing to add. A row with
 * no caveat is a row with no caveat; an empty paragraph under it would space
 * the panel out for the sake of what is not there.
 */
export type PanelFigure = {
  /** What the figure is called, in words a client would recognise. */
  label: string;
  /** The figure itself, or what stands in for it when there is none. */
  value: string;
  /** How to read it, where the figure alone would mislead. */
  note: string | null;
};
