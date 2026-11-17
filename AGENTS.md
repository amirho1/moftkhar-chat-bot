# Instructions for AI coding assistants

This is a reusable DocsGPT support-chat starter. It contains no production organization configuration. Never assume access to private accounts, MCP connections, browsers, sibling checkouts or infrastructure.

## Architecture and boundaries

- `src/server.ts`: Node HTTP gateway and small demonstration page. It serves the pinned widget and a public configuration projection, fixes the agent key server-side, and refuses management paths.
- `src/lib/`: configuration validation, bounded input, signed anonymous sessions, shared Redis limits, conversation ownership and safe SSE projection.
- `scripts/`: TypeScript installation, initialization, management bootstrap, synchronization, diagnostics and privacy scanning. Keep new starter scripts in TypeScript. DocsGPT itself remains Python.
- `config/starter.json`: public organization, website, support destination, language, branding, approved knowledge and agent limits. Use fictional defaults.
- `demo/`: explicitly fictional knowledge. Real approved knowledge belongs in ignored `knowledge/` or a private configuration outside Git.
- `source.lock.json`: public source repository plus full immutable fork revision. The fork includes Persian localization and dynamic RTL/LTR. Never replace it with an unchanged npm release.
- `Dockerfile`, `docker-compose.yml`: Node gateway, DocsGPT API/UI, PostgreSQL, Redis, Celery worker/beat and optional website-sync service. Database and Redis ports are private; management binds to loopback.
- `.runtime/` and `.private/`: ignored local state, source checkout, secrets and private deployment overlays. Never stage, print or upload their contents.

## Before editing

Read README, the relevant source, package scripts, lockfiles and deployment files. Inspect `git status` and preserve unrelated changes. Use existing modules and native DocsGPT APIs; do not invent a workflow JSON schema or start a second localization framework. Prefer small focused functions and explicit argument arrays over shell evaluation. No administrative runtime tools, arbitrary URLs, customer identity inference or write actions belong in public chat.

## Supported toolchain and commands

Use Node 22.12–22.x and npm. Docker Engine with Compose v2 is the primary container path. Native development targets macOS and Linux; Windows uses WSL2. Native prerequisites: Python 3.12 (uv can install it), uv, Git, Node, PostgreSQL 16 server/client binaries, Redis server/client, Bash and npm. Keep `initdb`, `pg_ctl`, `psql`, `createdb`, `redis-server` and `redis-cli` on PATH.

Run all commands from this repository root:

```sh
npm ci
npm run setup -- --mode=docker
npm run doctor
```

Docker setup builds the pinned source and starts the full stack. For operations:

```sh
docker compose --env-file .runtime/docker.env ps
docker compose --env-file .runtime/docker.env run --rm web npm run bootstrap
docker compose --env-file .runtime/docker.env logs --tail=50 api worker web
docker compose --env-file .runtime/docker.env stop
```

Native path, with independent dedicated database ports:

```sh
npm run setup -- --mode=native
npm run services
npm run dev
```

In another terminal:

```sh
npm run doctor
npm run bootstrap
```

`npm run dev` applies migrations and starts the API plus Celery/beat and the gateway. A frontend-only server is not a complete install. Production requires supervised processes or the container stack and verified TLS/ingress; do not describe `npm run dev` as a production service manager.

Validation:

```sh
npm run build
npm test
npm run scan
npm run check
```

For UI changes, rebuild the pinned widget or use a reviewed fork revision; test Persian RTL, English LTR, both opposite host directions, mobile widths, IME, mixed content and safe source links. UI locale and answer language are separate. Never set the base application globally RTL.

## Deployment and updates

Keep chat disabled until provider generation, ingestion, retrieval/citations, limits, ownership and anonymous widget checks pass. Check server capacity, take backups, record current source/image versions and rollback steps, and preserve persistent encryption/signing keys. Never delete volumes, reset a working tree, force-push, overwrite existing config, or rewrite shared history. Do not publish images/artifacts or change repository visibility without explicit authorization. Updating the source lock is a reviewed source change, followed by clean builds and regression tests.

Production organization overlays are optional and private. Never copy their domain, provider, support details, exports or screenshots into examples. Provider-specific configuration belongs in ignored overlays; public configuration remains provider-agnostic.

The optional `release.yml` workflow builds/verifies AMD64 images on GitHub and deploys only after its successful build job. `scripts/deploy-dokploy.ts` accepts a reviewed private JSON template and replaces image placeholders with immutable GHCR digests; it rejects server-side builds and preserves Dokploy environment secrets. Configure release secrets outside Git. Do not change the success dependency or bypass runtime acceptance because CI passed. See `docs/DEPLOYMENT.md` for the manual `gh workflow run release.yml -f deploy=true` command and required secret names.

After changes, update affected documentation and run relevant tests. Report implemented, tested, deployed and blocked work separately, with exact commands and limitations. Mocked tests and API health do not prove live retrieval or production readiness. Never print secrets, full environment files, raw customer content or model request headers.
