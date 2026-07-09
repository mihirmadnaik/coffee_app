# scan-bean Edge Function

Receives a coffee-bag photo (base64 data URL) from the app, sends it to
Claude vision with a structured-output schema, and returns bean fields
(`name`, `roaster`, `origin`, `process`, `roastLevel`, `tastingNotes`)
for pre-filling the Add Bean form.

The Anthropic API key lives server-side as a Supabase secret — it is never
shipped to the browser. Only signed-in users can call the function.

## One-time deploy

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) logged in
to the project:

```sh
# 1. Store the Anthropic API key as a secret (console.anthropic.com → API keys)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 2. Deploy (JWT verification stays ON — the default)
supabase functions deploy scan-bean
```

## Cost

Images are downscaled to ~1024px client-side before upload (~1,000 image
tokens). Each scan is roughly 1,500 tokens total — a fraction of a cent on
`claude-opus-4-8`. Swap the `model` string in `index.ts` for a cheaper
model if desired.
