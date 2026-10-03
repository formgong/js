<script>
  // <FormgongForm accessKey="fk_…" let:submitting> …fields… </FormgongForm>
  // Hidden fields, honeypot, anti-spam signals and an aria-live status line. Events: success, error.
  import { createEventDispatcher } from "svelte";
  import { formgong, DEFAULT_ENDPOINT } from "./index.js";

  /** Public form key (fk_…). */
  export let accessKey;
  export let endpoint = undefined;
  export let lang = undefined;
  export let subject = undefined;
  export let redirect = undefined;
  export let antiSpam = true;
  export let hideStatus = false;
  export let statusClass = undefined;

  const dispatch = createEventDispatcher();
  let state = { status: "idle", message: "", submitting: false, error: null, result: null };
  $: options = {
    accessKey, endpoint, lang, subject, redirect, antiSpam,
    onState: (s) => (state = s),
    onSuccess: (result) => dispatch("success", result),
    onError: (error) => dispatch("error", error),
  };
</script>

<form action={endpoint || DEFAULT_ENDPOINT} method="POST" aria-busy={state.submitting} use:formgong={options} {...$$restProps}>
  <input type="hidden" name="access_key" value={accessKey} />
  {#if lang}<input type="hidden" name="_lang" value={lang} />{/if}
  {#if subject}<input type="hidden" name="_subject" value={subject} />{/if}
  {#if redirect}<input type="hidden" name="_redirect" value={redirect} />{/if}
  <div aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden">
    <input name="botcheck" tabindex="-1" autocomplete="off" />
  </div>
  <slot status={state.status} message={state.message} submitting={state.submitting} error={state.error} />
  {#if !hideStatus}
    <p role="status" aria-live="polite" class={statusClass} data-status={state.status}
      style={statusClass ? undefined : `margin:0;font-size:14px;color:${state.status === "error" ? "#b91c1c" : "#15803d"}`}>{state.message}</p>
  {/if}
</form>
