"use client";

import { useEffect } from "react";

import { firstErrorField, type FormState } from "@/lib/forms/state";

import { fieldId } from "./ids";

/**
 * Moves the cursor to the first field that needs fixing after a rejected
 * submission. Without it the page looks unchanged from the keyboard: focus is
 * still on the save button, and the messages are wherever they happen to be.
 *
 * `order` is the order the form lays its fields out, not the order the errors
 * arrived in — the cursor has to land on the first problem the user would
 * read on the way down the page.
 *
 * `scope` is the form, for a page holding more than one of them. Without it the
 * cursor would land on whichever copy of the field the document happens to hold
 * first: a rejected edit in a scope row would move focus into the add line at
 * the bottom of the page, under a message about a different form.
 */
export function useFirstErrorFocus<K extends string>(
  state: FormState<K>,
  order: readonly K[],
  scope?: string,
): void {
  useEffect(() => {
    const name = firstErrorField(state, order);
    if (name === null) return;
    document.getElementById(fieldId(name, scope))?.focus();
  }, [state, order, scope]);
}
