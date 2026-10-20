# Public API (`/api/v1`)

Authenticate with `Authorization: Bearer sk_...` (create keys in Settings → API keys; the full key
is shown once and stored as a SHA-256 hash). The key identifies the organization.

| Method | Path                                     | Returns                                                    |
| ------ | ---------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/v1/me`                             | Organization name, slug, plan, limits                      |
| GET    | `/api/v1/members`                        | Members and roles                                          |
| GET    | `/api/v1/usage`                          | AI tokens used and remaining this period                   |
| GET    | `/api/v1/audit-logs?limit=50&cursor=...` | Audit events, newest first; next cursor in `x-next-cursor` |
| POST   | `/api/v1/ai/chat`                        | AI reply, or a text stream when `"stream": true`           |

```bash
curl -X POST $APP_URL/api/v1/ai/chat -H "Authorization: Bearer sk_..." -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Summarize this ticket in one line."}],"tier":"fast"}'
# {"data":{"text":"...","usage":{"inputTokens":41,"outputTokens":12}}}
```

**Limits:** 60 requests/minute per key (`X-RateLimit-Limit`, `-Remaining`, `-Reset` headers);
list endpoints take `limit` (default 50, max 100). Timestamps are ISO 8601 UTC; money is in minor units.

**Errors** always look like:
`{ "error": { "code": "QUOTA_EXCEEDED", "message": "...", "requestId": "req_8f2c1a" } }`

| Code             | HTTP | Meaning                                     |
| ---------------- | ---- | ------------------------------------------- |
| UNAUTHENTICATED  | 401  | Missing, invalid or revoked key or session  |
| FORBIDDEN        | 403  | Authenticated but lacking the permission    |
| NOT_FOUND        | 404  | Missing, or belongs to another organization |
| VALIDATION_ERROR | 422  | Zod failure; `details` lists fields         |
| CONFLICT         | 409  | Duplicate slug, email already invited       |
| QUOTA_EXCEEDED   | 402  | Plan limit reached                          |
| RATE_LIMITED     | 429  | Too many requests; `Retry-After` set        |
| INTERNAL         | 500  | Unexpected; logged with `requestId`         |
