/**
 * @formgong/next: Formgong for Next.js.
 *   Server Actions / Route Handlers: import from "@formgong/next/server"
 *   Client components:              import from "@formgong/next/client"
 * This entry re-exports the server helpers and shared types (no React code).
 */
export * from "./server.js";
export { FormgongError, isFormgongError, DEFAULT_ENDPOINT, type FormgongErrorCode, type SubmitResult } from "@formgong/core";
