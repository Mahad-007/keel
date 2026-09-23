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
 */
export function useFirstErrorFocus<K extends string>(
  state: FormState<K>,
  order: readonly K[],
): void {
  useEffect(() => {
    const name = firstErrorField(state, order);
    if (name === null) return;
    document.getElementById(fieldId(name))?.focus();
  }, [state, order]);
}
