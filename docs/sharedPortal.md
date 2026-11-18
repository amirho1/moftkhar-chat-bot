# Shared backend for a small customer portal

Run one shared DocsGPT API/worker/Postgres/Redis stack. A trusted server-side portal
can issue short-lived `simple_jwt` credentials with a distinct opaque subject for each
workspace. Never give its signing key or native management credentials to a browser.
Do not create a model process or database per customer.

Fix source, agent, model, read-only tools and prompt policy on the portal server.
Use a separate anonymous visitor credential and enforce conversation ownership,
access expiry, atomic quota reservations and origin restrictions before generation.
Native agent keys alone are public-chat capabilities, not customer account sessions.
Keep the management dashboard and general APIs private behind the existing protection.

The pinned website loader accepts `exclude_private_paths: true` in website config.
It excludes common administrative/account/cart/checkout segments at any path depth
and rejects query URLs. `discovery: links`, `include_subdomains: false`, an explicit
`path_prefix`, and `max_pages: 100` bound the source. Scope is checked before redirects
and private/DNS-rebinding destinations remain blocked. The deployment-wide
`WEB_MAX_PAGES` must permit the published maximum. Existing callers retain their
behavior unless they opt into private-path exclusion.

This fork requires context windows of at least 16,000 and history windows of at least
4,000 tokens. An import may return success **with warnings** after removing invalid
config: callers must reject warnings rather than assume every policy was applied.
Publish returns a fresh native key once; if that response is lost, use the authenticated
owner-only `regenerate_agent_key` endpoint and persist the replacement server-side.
Do not mark an empty/failed source ready or start a trial before readiness.

Keep native `token_usage` and request-trace attribution. Pass an opaque reservation ID
as `request_id` so the portal can audit generation and side-channel usage together.
Provider-reported tokens and fallback estimates are different evidence; do not treat
configured model prices as verified provider invoices. Keep chat disabled until the
selected provider, reasoning mode, retrieval, citations and spend ceilings are verified.

For commercial integration, keep phone-only OTP identity, payment intents, verified
grants in the existing application. The customer billing UI can run in the fork’s restricted customer build. Reuse its SMS provider and gateway.
Never trust browser success flags or caller-supplied tenant/price/duration values.
Do not add registration passwords, required email, public tools or per-tenant stacks.
No company secrets, phone records or deployment overlays belong in this reusable repo.

Build/test with `npm run check`; source changes also need the fork's parser, ownership
and import tests. Build both widget entries from the pinned revision with `npm run build`
then `npm run build:react`, then pack. Use existing release/build workflows and verified
private originals for Dokploy updates; never replace configuration from redacted output.
Record image digests and back up persistent data before any authorized release.

When verification is constrained to an existing Chrome session, attach only through
the authorized extension or already-enabled connection. Never launch another browser,
change startup flags, use Brave, clear shared cookies or close the user's browser.
Report any unrun mobile/widget checks separately from mocked API tests.

## Customer frontend and upstream fixes

The fork’s `feat/customer-saas-panel` branch adds a separate `customer.html` entry
inside the existing DocsGPT frontend. It directly reuses upstream section navigation,
layouts, forms, cards, mobile sheets, translation and direction components. The normal
management entry remains unchanged and private. A scoped adapter calls the existing
application’s owner-authorized APIs; it never initializes native authentication or
loads native browser credentials. Hiding navigation is not a security boundary.

Keep the shared native backend/widget source lock independent of the customer UI pin.
Build the customer entry with `npm run build:customer` in the fork’s frontend, then use
`node scripts/package-customer.mjs /absolute/artifact/directory` from a clean committed
revision. The bundle includes its source revision, license and SHA-256 manifest. See
the fork’s `CUSTOMER_PANEL.md` for integration and update commands.

Fetch upstream fixes into a temporary integration branch, merge and resolve conflicts,
run native/customer builds, regression tests and authorized browser acceptance, then
merge into the customer feature branch. Pin the reviewed artifact before deploying;
never reset the feature branch or auto-deploy untested upstream updates.
