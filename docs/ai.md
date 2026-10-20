# The AI layer

Add a paid AI feature in about 30 lines: write a prompt function in `src/server/ai/prompts/` and
call `runAi` (or `streamAi`). The layer handles provider choice, quotas, rate limits and usage logging.

```ts
const result = await runAi(
  { db: ctx.db, org: ctx.org, userId: ctx.user.id, rateKey: ctx.user.id },
  { feature: "summarize", tier: "fast", maxTokens: 512, ...summarizePrompt(data) },
);
```

- Providers: `anthropic`, `openai` (via the Vercel AI SDK) and `mock` (free, streams canned
  replies with realistic token counts). Choose with `AI_DEFAULT_PROVIDER`; models from
  `AI_MODEL_FAST` / `AI_MODEL_SMART` (defaults: `claude-haiku-5-5` / `claude-sonnet-5-5`).
  A missing key falls back to `mock` with a warning; `DEMO_MODE` always uses `mock`.
- Quota: tokens summed over the billing period (calendar month on Free) against the plan's
  `aiTokensPerMonth`. 80% shows a warning, 100% throws `QUOTA_EXCEEDED` (402).
- Guardrails: 20 requests/minute per user (or per API key), `maxTokens` capped at 4096, 32k
  input characters, upstream calls aborted when the client disconnects.
- Every call writes one `AiUsageEvent`; streams write it in the finish callback (also on abort).
