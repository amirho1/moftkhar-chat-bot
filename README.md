# DocsGPT chatbot starter

The pinned fork supports bounded website sources with optional private-path exclusion
and validates crawl scope before following redirects. Website requests identify
DocsGPT without a fabricated search-engine referrer, avoiding HTTP 406 responses
from sites that reject incomplete browser identifiers. A separate customer portal can
use one native authenticated identity per workspace while keeping this management
service private. See [shared-backend integration](docs/sharedPortal.md).

Build a support chatbot with an AI coding assistant. The starter includes a Persian-enabled DocsGPT fork, a chat widget, a protected public gateway, and fictional example knowledge. Persian uses RTL; English uses LTR. You do not need any private account or infrastructure connection to install it.

**Release status: under verification.** The code has focused automated checks, but the release checklist in [docs/VERIFICATION.md](docs/VERIFICATION.md) must pass before production use or describing this repository as ready to share.

All commands below run in the folder containing this README. If a command fails, stop at that step and use the troubleshooting guide; do not delete databases or paste secrets into a conversation.

## What you need

- Git and Node.js **22.12 or newer within Node 22**.
- For Docker: Docker Engine/Desktop with Compose v2, at least **4 GB available memory** and roughly **10 GB free disk** for dependencies, images, models and data. Leave additional capacity for existing services.
- For native installation: macOS or Linux (Windows: WSL2), Bash, uv, PostgreSQL 16 and Redis. Python 3.12 can be installed by uv. See [native setup](docs/INSTALLATION.md).
- An authorized model provider with an OpenAI-compatible endpoint. The model may charge for requests. Hosting, storage, backups, bandwidth and Docker Desktop licensing may also have costs. This starter does not buy services or change billing.

## Easiest path: Docker

```sh
npm ci
npm run setup -- --mode=docker
```

Setup creates `.env` if missing, generates missing secrets once, fetches the pinned **public** DocsGPT source, and builds/starts PostgreSQL, Redis, API, worker/beat and web gateway. Repeating setup preserves existing configuration, secrets and data. The first build downloads dependencies and embedding weights and can take several minutes.

Open `.env` in your local editor and set `OPENAI_BASE_URL`, `API_KEY` and `LLM_NAME` from your authorized provider. Do not put credentials in `config/starter.json`, commits, screenshots or AI chat. Rerun setup to regenerate the private runtime environment and recreate only this starter's services with the new values.

```sh
docker compose --env-file .runtime/docker.env ps
docker compose --env-file .runtime/docker.env run --rm web npm run bootstrap
```

Success means the services are healthy and bootstrap reports that fictional knowledge was indexed and a **draft** support agent was imported. Visit `http://localhost:3080`. The launcher should be Persian and RTL; chat stays disabled until you review/publish the agent and set its server-only key and `CHAT_ENABLED=true`. This deliberate review step prevents accidental use of a demo agent or a broken provider.

## Without Docker

Install the prerequisites from [docs/INSTALLATION.md](docs/INSTALLATION.md), then:

```sh
npm ci
npm run setup -- --mode=native
npm run services
npm run dev
```

Keep that terminal open. The dedicated local PostgreSQL database uses port `55432`; Redis uses `56379`. Existing databases are not stopped or reused automatically. `npm run dev` applies supported migrations and starts the API, required worker/beat and gateway. In a second terminal:

```sh
npm run doctor
npm run bootstrap
```

A frontend by itself cannot answer questions: the database, Redis, API, worker, embeddings and indexed knowledge must also work.

For an explicit no-provider protocol demo, use `--mock-model` with setup (Docker) or `dev` (native). This selects a fictional local fixture in the derived runtime environment; it never changes your saved provider settings. Mock responses do not validate real answer quality. Run one mode at a time: both use local ports 7091 and 3080. Stop only your own earlier test stack before switching modes.

## Make it yours

Edit `config/starter.json` for organization name, public website/support link, branding, language, suggested questions and approved knowledge. Replace fictional material with approved public information in ignored `knowledge/`. Configure credentials locally in `.env`. Website sources use native DocsGPT ingestion and synchronization; see [configuration](docs/CONFIGURATION.md). There is no live pricing or customer-account tool in the generic starter.

Use the protected DocsGPT management UI/API only on loopback or through your authenticated private tunnel. Review the draft agent, retrieve sample passages, publish it through `/api/update_agent/<id>`, and store its key only as `CHAT_AGENT_KEY` in `.env`. Verify anonymous questions and citations before enabling public access. See [deployment and rollback](docs/DEPLOYMENT.md).

## Ask your AI assistant

Copy a prompt from [docs/AI-PROMPTS.md](docs/AI-PROMPTS.md). Example:

> Read AGENTS.md and inspect this repository. Help me install the full fictional demo using Docker. Preserve existing files and services. Tell me where to enter secrets locally; never ask me to paste keys or full environment files into chat. Run the checks and report any step you could not verify.

Useful checks:

```sh
npm run doctor
npm run check
```

`doctor` hides credential values. A green health endpoint does not prove that the model, retrieval or citations work. For recovery and safe updates, read [troubleshooting](docs/TROUBLESHOOTING.md) and [privacy/release checks](docs/PRIVACY.md).

[راهنمای شروع سریع فارسی](docs/QUICKSTART.fa.md)
