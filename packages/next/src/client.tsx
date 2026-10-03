"use client";
/**
 * @formgong/next/client: client components for the App Router.
 * - Re-exports @formgong/react (<ContactForm>, <FormgongForm>, useFormgong) for direct browser posts.
 * - <ActionForm action={serverAction}> for posting through your own Server Action.
 */
import * as React from "react";
import * as ReactDOM from "react-dom";
import type { FormgongActionState } from "./server.js";

// Named re-exports: Next.js does not allow `export *` across a client boundary.
export { ContactForm, FormgongForm, Honeypot, useFormgong, DEFAULT_ENDPOINT, FormgongError, isFormgongError } from "@formgong/react";
export type { ContactFormProps, ContactFormLabels, FormgongFormProps, FormgongOptions, FormgongResult, FormgongStatus, UseFormgong } from "@formgong/react";
export { default } from "@formgong/react";

type ActionFn = (state: FormgongActionState, payload: FormData) => FormgongActionState | Promise<FormgongActionState>;
type UseActionState = (action: ActionFn, initial: FormgongActionState) => [FormgongActionState, (payload: FormData) => void, boolean?];

/** React 19 `useActionState`, falling back to React 18 `useFormState` (Next 14). */
export function useFormgongAction(action: ActionFn): { state: FormgongActionState; formAction: (payload: FormData) => void; pending: boolean } {
  const hook = ((React as unknown as { useActionState?: UseActionState }).useActionState ?? (ReactDOM as unknown as { useFormState: UseActionState }).useFormState) as UseActionState;
  const [state, formAction, pending] = hook(action, { status: "idle", message: "" });
  return { state, formAction, pending: Boolean(pending) };
}

const honeypotStyle: React.CSSProperties = { position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" };

export type ActionFormProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "children"> & {
  action: ActionFn;
  children: React.ReactNode | ((state: { state: FormgongActionState; pending: boolean }) => React.ReactNode);
  hideStatus?: boolean;
  statusClassName?: string;
};

/** `<ActionForm action={contact}>…fields…</ActionForm>`: honeypot + status line around a Server Action. */
export function ActionForm({ action, children, hideStatus, statusClassName, ...rest }: ActionFormProps) {
  const { state, formAction, pending } = useFormgongAction(action);
  return (
    <form {...rest} action={formAction as unknown as string} aria-busy={pending}>
      <div aria-hidden="true" style={honeypotStyle}><input name="botcheck" tabIndex={-1} autoComplete="off" /></div>
      {typeof children === "function" ? children({ state, pending }) : children}
      {hideStatus ? null : (
        <p role="status" aria-live="polite" className={statusClassName} data-status={state.status} style={statusClassName ? undefined : { margin: 0, fontSize: 14, color: state.status === "error" ? "#b91c1c" : "#15803d" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
