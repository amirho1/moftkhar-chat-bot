# Production deployment and recovery

The starter is provider-agnostic. Private deployments may supply their own config file and environment through a secret manager or ignored overlay. No private infrastructure, package registry or browser session is required for installation.

## Optional GitHub runner release

`.github/workflows/release.yml` builds Linux AMD64 images on GitHub, verifies actual offline embedding/tokenizer execution, and publishes the backend plus gateway to GHCR. It is manual (`workflow_dispatch`), with deployment off by default. The deployment job has `needs: build`: a failed check, build, embedding verification or image push cannot trigger deployment. The target server pulls immutable image digests and does not compile source. Runtime CPU compatibility still needs verification on that server.

For the optional Dokploy MCP release adapter, configure encrypted GitHub Actions secrets outside Git: `DOKPLOY_MCP_URL`, `DOKPLOY_MCP_HEADERS` (a JSON header map), `DOKPLOY_COMPOSE_ID`, and `DOKPLOY_COMPOSE_JSON` (a reviewed private JSON Compose template). Use `__DOCSGPT_IMAGE__` and `__GATEWAY_IMAGE__` image placeholders; omit all `build` fields and floating `latest` references. Keep credentials in Dokploy's existing environment, referenced through `.env`; the release adapter deliberately preserves that environment and volumes. Ensure the target can authenticate to GHCR if the packages are private. The adapter is optional; ordinary Docker/native installation does not require an MCP connection.

From a configured repository checkout, an authorized operator can run:

```sh
gh workflow run release.yml -f deploy=true
gh run list --workflow release.yml
```

Older x86 VMs may expose insufficient CPU instructions for current binary wheels even when compilation succeeds elsewhere. The optional `legacy_cpu=true` workflow input rebuilds the **same pinned NumPy source version** with `cpu-baseline=none` and disables dispatch, then tests offline embeddings and FAISS under a restricted emulated CPU before publication. It preserves the embedding model and vector format. This compatibility path is under verification; every target still requires its own embedding/application checks and ingestion/query latency measurements before chat is enabled.

```sh
gh workflow run release.yml -f deploy=true -f legacy_cpu=true
```

The release job checks Dokploy's deployment result. Live Persian generation, source correctness, ownership, widget functionality and production-host embedding compatibility remain required acceptance checks after deployment. Keep public chat disabled until they pass. Never paste the secret header map or private template into an AI conversation.

Before production: verify at least 4 GB available memory plus capacity for other services; use immutable source/image revisions; back up state; record the running versions; verify the provider's real generation and reasoning parameters; inspect retrieved passages; test anonymous isolation, limits, streaming/cancellation and source links. Do not enable chat based only on container health or mocked tests.

The Compose file deliberately binds the gateway and protected management port to loopback. Put only the gateway behind your existing authenticated hosting/ingress/TLS arrangement. Keep management private or require a separate authenticated tunnel/access policy. Never route the whole backend API publicly just to make the widget work. Do not expose PostgreSQL, Redis or internal worker ports. Do not start a competing reverse proxy if your host already has ingress.

Configure an approved provider locally in `.env`, run setup to regenerate `.runtime/docker.env`, then bootstrap. Bootstrap creates a draft. Review `/api/get_agent?id=<id>` and the native source status with the management token on the server; publish with `PUT /api/update_agent/<id>` and `{ "status": "published" }`. Save the **freshly returned** agent key locally as `CHAT_AGENT_KEY`; `/api/get_agent` deliberately returns a masked key that cannot authenticate. Preserve an existing saved key; do not rotate it merely because the detail response is masked. Set `CHAT_ENABLED=true`, regenerate runtime configuration, and restart only the gateway. These credentials must never be pasted into chat, logs or browser props. A coding assistant may automate this local operation after evidence is reviewed; it must not print the request headers or returned key.

For Docker:

```sh
docker compose --env-file .runtime/docker.env ps
docker compose --env-file .runtime/docker.env logs --tail=50 api worker web
docker compose --env-file .runtime/docker.env restart web
```

For native production, supervise the same API, worker/beat, gateway and optional website-sync commands with your existing service manager. Keep exactly one intended scheduler per deployment; the worker starts beat, and native development does too. Configure restart-on-failure, graceful termination, logging retention, least-privileged service users and persistent paths. `npm run dev` is a development orchestrator, not a production supervisor. A production service-manager template has not been validated on every distribution.

Back up PostgreSQL plus `inputs`, `indexes`, `vectors`, and the stable encryption/signing configuration. Example Docker database backup, executed locally on the operator host:

```sh
mkdir -p .private/backups
docker compose --env-file .runtime/docker.env exec -T postgres pg_dump -U chatbot -d chatbot -Fc > .private/backups/chatbot.dump
```

Back up filesystem volumes using the host's supported snapshot procedure while ingestion is quiesced. Verify a restore into **separate** disposable volumes/database before relying on backups. Do not restore over a live production database. Never use `down -v` as troubleshooting. There is no automated claim that backup restoration has been tested unless the verification report records it.

Quick disable: set `CHAT_ENABLED=false` in the private configuration, regenerate `.runtime/docker.env` using `npm run setup` only when an authorized rebuild/recreate is intended, or call the configuration helper through a local AI assistant and restart the gateway. Preserve databases and volumes. For a private storefront integration, use its own runtime feature switch and existing release process.

Rollback: record the previous `source.lock.json`, application configuration and image digest before deployment. Restore those reviewed source/config revisions, rebuild/redeploy through the same process, and restart the gateway with chat disabled while checking schema compatibility. Database rollback requires a tested compatible backup/restore plan; blindly running an older image against a migrated database is unsafe. No production rollback or restore is considered verified by static configuration validation alone.

Usage is bounded by Redis session/network/global hourly limits, shared concurrency leases and native agent token/request quotas. Configure provider-side spending caps where available. Keep full messages out of application logs; trace previews are disabled. DocsGPT still persists conversations for its normal features: establish, implement and test a retention/deletion policy before collecting real users' conversations. This starter does not yet claim automated conversation retention cleanup.
