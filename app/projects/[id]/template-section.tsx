import { INITIAL_APPLY_TEMPLATE_STATE } from "@/lib/templates/apply-form";
import { initialSaveTemplateState } from "@/lib/templates/form";
import { templateOptions } from "@/lib/templates/options";
import type { SummarisedTemplate } from "@/lib/templates/summary";

import { ApplyTemplateForm } from "./apply-template-form";
import { SaveTemplateForm } from "./save-template-form";

/**
 * The two template controls, at the foot of the scope tab.
 *
 * Both of them, on every project, because which one a reader wants depends on
 * where they are in the work rather than on anything the page can see: the
 * project that has just been created wants to apply one, and the one that is
 * finished wants to be saved as one. Hiding either would mean guessing, and
 * guessing wrong means a reader concluding the feature is not there.
 *
 * Below the add line rather than above the list, which is the order of
 * likelihood: most visits to this tab are to read or add a line, and these two
 * are the once-per-engagement controls. A picker that could rewrite the scope
 * list should not be the first thing under the heading either.
 */
export function TemplateSection({
  projectName,
  templates,
  scopeIsEmpty,
  apply,
  save,
}: {
  /** What the save form suggests as the template's name. */
  projectName: string;
  /** Every saved template, each with its size. Empty before any is saved. */
  templates: readonly SummarisedTemplate[];
  /**
   * Whether this project has anything agreed yet, which decides whether there
   * is anything to save. Taken as a flag rather than the list itself: this
   * component shows no deliverable, and handing it the rows would invite it to.
   */
  scopeIsEmpty: boolean;
  apply: Parameters<typeof ApplyTemplateForm>[0]["apply"];
  save: Parameters<typeof SaveTemplateForm>[0]["save"];
}) {
  const options = templateOptions(templates);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Templates
      </h3>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        A template is a scope list saved on its own, so the next engagement of
        the same shape starts from it rather than from a blank page. Applying
        one adds its deliverables to the end of this list; saving one takes a
        copy of the list as it stands and leaves this project untouched.
      </p>

      {options.length === 0 ? (
        <NoTemplates />
      ) : (
        <ApplyTemplateForm
          apply={apply}
          initialState={INITIAL_APPLY_TEMPLATE_STATE}
          options={options}
        />
      )}

      <div className="mt-8">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Save this scope list as a template
        </h4>
        {scopeIsEmpty ? (
          <NothingToSave />
        ) : (
          <SaveTemplateForm
            save={save}
            initialState={initialSaveTemplateState(projectName)}
          />
        )}
      </div>
    </section>
  );
}

/**
 * No template has been saved by anyone yet.
 *
 * It says where templates come from rather than only that there are none,
 * because the answer is the form directly underneath — and a reader who thinks
 * templates are something the product ships will go looking for a library that
 * does not exist.
 */
function NoTemplates() {
  return (
    <p className="mt-4 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      No templates saved yet, so there is nothing to apply. They come from
      projects: finish agreeing a scope list, save it below, and it will be on
      offer here on every project after this one.
    </p>
  );
}

/**
 * The project has no deliverables, so there is nothing to make a template out
 * of.
 *
 * The form is not rendered at all rather than rendered and refused. A name box
 * above a button that cannot work is a form that wastes a sentence somebody
 * composed — and the write refuses an empty scope list anyway, which covers the
 * page having been open while the last deliverable was deleted.
 */
function NothingToSave() {
  return (
    <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      Nothing to save yet — a template is made of deliverables, and this project
      has none. Add the first line above and this becomes a one-press job.
    </p>
  );
}
