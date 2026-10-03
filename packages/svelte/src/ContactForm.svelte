<script>
  // <ContactForm accessKey="fk_…" /> : ready-made name / email / message form.
  import FormgongForm from "./FormgongForm.svelte";

  export let accessKey;
  export let labels = {};
  $: text = { name: "Name", email: "Email", message: "Message", submit: "Send", sending: "Sending…", ...labels };
</script>

<FormgongForm {accessKey} {...$$restProps} on:success on:error let:submitting
  style="display:grid;gap:16px;max-width:512px">
  <label style="display:grid;gap:6px">{text.name}<input name="name" autocomplete="name" required /></label>
  <label style="display:grid;gap:6px">{text.email}<input type="email" name="email" autocomplete="email" required /></label>
  <label style="display:grid;gap:6px">{text.message}<textarea name="message" rows="5" required></textarea></label>
  <button type="submit" disabled={submitting}>{submitting ? text.sending : text.submit}</button>
</FormgongForm>
