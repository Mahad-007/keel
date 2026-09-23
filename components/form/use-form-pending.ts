"use client";

import { useFormStatus } from "react-dom";

/**
 * Whether the nearest enclosing `<form>` is currently on its way to the
 * server.
 *
 * A wrapper around `useFormStatus` for two reasons. It narrows the hook to the
 * one bit anything in this app needs: the rest of the status object — the
 * submitted `data`, `method`, `action` — is only populated mid-flight, and
 * reading it is a way to depend on a transient. And it puts the hook's one
 * real trap in a single place: `useFormStatus` reports on an *ancestor* form,
 * so a component that calls this must be rendered inside the form, not be the
 * component that renders it. Called in the form component itself it quietly
 * returns false forever.
 */
export function useFormPending(): boolean {
  const { pending } = useFormStatus();
  return pending;
}
