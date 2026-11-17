# Complete installation paths

Use Node 22.12–22.x. Run commands from the repository root. Both paths share `config/starter.json`, `.env`, `source.lock.json`, initialization, the native DocsGPT import API and the same persistent secrets. Never use a sibling checkout or a private package to install this starter.

Docker requires Engine/Desktop with Compose v2 and 4 GB available memory. `npm run setup -- --mode=docker` writes `.runtime/docker.env` privately, builds the pinned public source, and starts the API/UI, worker/beat, PostgreSQL, Redis and public gateway. Pending migrations run through DocsGPT's supported `AUTO_MIGRATE` API startup; the worker waits for API health and does not migrate independently. Named volumes retain database, inputs, indexes and vectors.

Native development targets macOS and Linux, with Bash. Windows must use WSL2; native Windows has not been validated. Install prerequisites using your OS package manager (examples; package availability varies):

```sh
# macOS with Homebrew
brew install postgresql@16 redis uv
export PATH="$(brew --prefix postgresql@16)/bin:$PATH"

# Ubuntu/Debian: use a supported PostgreSQL 16 package repository if 16 is not in your distribution.
sudo apt-get install git build-essential postgresql-16 postgresql-client-16 redis-server
export PATH="/usr/lib/postgresql/16/bin:$PATH"
```

Install Node 22 and uv from their official distributions if your OS package manager does not provide suitable versions. Do not run this project as root. `uv` installs Python 3.12 and locked Python dependencies. The PostgreSQL `initdb` command refuses root for good reason.

```sh
npm ci
npm run setup -- --mode=native
npm run services
npm run dev
```

Setup fetches the immutable source, installs locked dependencies, builds the management UI and the Persian-enabled browser widget. `services` initializes **only** `.runtime/postgres` and `.runtime/redis` on dedicated loopback ports 55432/56379. It preserves existing clusters and refuses automatic initialization of an arbitrary external database. For an existing authorized database, configure `.env` yourself and skip `services`; arrange the database/role/permissions through your normal process.

`dev` first runs `docsgpt migrate`, then `docsgpt dev --no-reload` (API plus required worker and beat) and the Node gateway. Website sync is started only when configured. Files are not crawled periodically; review updates and use the supported DocsGPT reingest operation. Neither mode enables chat automatically.

In another terminal, run `npm run doctor` and `npm run bootstrap`. Configure a valid provider locally before bootstrap. It ingests the fictional file and imports a draft, idempotently by source name and agent slug. A failed index/import leaves chat disabled. Confirm source passages, model behavior and citations before publishing the agent. Keep the agent key server-side. Native services need supervision in production; see DEPLOYMENT.md.

To stop native development, press Ctrl+C in its terminal. Dedicated data services may remain available; stop only this project's own cluster with `pg_ctl -D .runtime/postgres stop -m fast` and its own Redis with `redis-cli -h 127.0.0.1 -p 56379 shutdown`. Never stop a shared service merely to make a port available.

For a fictional Docker test without provider access, run `npm run setup -- --mode=docker --mock-model`. It explicitly starts a private mock service with no host port and writes only derived test settings. Native `npm run dev -- --mock-model` uses DocsGPT's existing mock process. These are protocol/integration fixtures, not working AI providers, and must never be described as live answer-quality verification. To bootstrap the native fixture in another terminal, use the derived environment: `STARTER_ENV_FILE=.runtime/native.env npm run bootstrap`.
