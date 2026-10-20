# Deployment

## Docker (self-hosting)

```bash
docker build -t launchkit .
docker run --env-file .env -p 3000:3000 launchkit   # runs `prisma migrate deploy`, then the server
```

Or `docker compose --profile app up` for the app plus Postgres. The image uses Next.js
`output: "standalone"` and validates environment variables at boot, not at build time.

## Managed hosts

Any host that runs Next.js works. Read each provider's free-tier terms first: some (for example
Vercel Hobby) restrict commercial use, which may include a demo that sells a product.
Configure cron calls to `/api/cron/*` with `CRON_SECRET`, and point provider webhooks at
`/api/webhooks/stripe` and `/api/webhooks/razorpay`.

Behind a proxy, make sure it sets `X-Forwarded-For`: the auth rate limits (5/minute for sign-in,
sign-up and reset) are keyed by client IP.
