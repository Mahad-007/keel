import { templateSizeLabel, type SummarisedTemplate } from "./summary";

/**
 * The templates a project's scope tab offers to apply.
 *
 * A picker is not a list: it has one line per template and no columns, so
 * everything that tells two templates apart has to fit in that line. Working
 * out what that line says is arithmetic on a couple of strings, and doing it
 * here rather than inside the JSX is what makes it testable — the same
 * reasoning, and the same shape, as the client picker in `lib/clients`.
 */

export type TemplateOption = {
  readonly id: string;
  /** What the option reads as, already disambiguated by size. */
  readonly label: string;
};

/**
 * One template on one line: its name, then what it adds up to.
 *
 * The size follows the name rather than leading it, because the name is what
 * the reader is scanning for and the size is what settles it once two names
 * look alike. The description is deliberately left out: it is a sentence, and a
 * sentence in a `<select>` option pushes the next template's name off the end
 * of the line.
 */
export function templateOptionLabel(template: SummarisedTemplate): string {
  return `${template.name} · ${templateSizeLabel(template)}`;
}

/**
 * The options the apply picker offers, in whatever order the template list was
 * read in.
 *
 * No equivalent of the client picker's `current`: a template is not filed
 * against the project, so there is no already-chosen one that has to be
 * offered back. Every option here is a template that exists right now, which
 * is what makes the submitted id checkable against this exact list.
 */
export function templateOptions(
  templates: readonly SummarisedTemplate[],
): TemplateOption[] {
  return templates.map((template) => ({
    id: template.id,
    label: templateOptionLabel(template),
  }));
}
