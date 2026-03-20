# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | ✅ Yes             |

## Reporting a Vulnerability

If you discover a security vulnerability, **please do NOT open a public GitHub issue**.

Instead, report it by emailing **security@your-domain.com** with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- (Optional) Suggested fix

We will acknowledge your report within **48 hours** and aim to release a fix within **7 days** for critical issues.

## Security Architecture

### Authentication
- All user-facing routes require valid Supabase JWT (`getUser()` verification)
- Role-based access control (RBAC) enforced at both frontend (`RoleProtectedRoute`) and database (RLS policies)
- Session inactivity timeout implemented

### Edge Functions
- **User-invoked functions** (send-event-photos, send-leader-affiliate-links, send-pass-notification, kb-*, analyze-*, generate-survey-questions): require `Authorization: Bearer <jwt>` header
- **Inbound webhooks** (zapi-webhook, smsdev-webhook, greatpages-webhook): support optional `WEBHOOK_SECRET` via `?secret=` query param or `x-webhook-secret` header
- **Meta Webhook**: verify token read from `META_WEBHOOK_VERIFY_TOKEN` env var (not hardcoded)

### Database (Supabase RLS)
- Row-Level Security enabled on all tenant-scoped tables
- Tenant isolation via `get_user_tenant_ids(auth.uid())` restrictive policies
- Service Role Key used only server-side (never in client bundle)

### HTTP Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy`: restricts scripts, styles, connections, frames
- `Permissions-Policy`: disables camera, microphone, payment, USB

### Dependencies
- `npm audit` runs in CI on every push
- Critical vulnerabilities block merges to `main`
- High vulnerabilities in production deps are reported (block via `--omit=dev`)

### CORS
- Supabase Edge Functions include `Access-Control-Allow-Origin: *` for browser compatibility
- CSP headers enforce the actual origin restriction at the browser level
- Planned: restrict CORS to app domain when all integration services are confirmed

## Environment Variables

Never commit secrets. Use:
- `.env.example` as the template (committed, no secrets)
- `.env.local` for local development (gitignored)
- Supabase project secrets (`supabase secrets set`) for Edge Functions

See `.env.example` for the full list of required variables.
