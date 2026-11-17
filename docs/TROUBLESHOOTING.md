# Troubleshooting without exposing secrets

For `Illegal instruction` or NumPy `X86_V2` failures, check exposed VM CPU flags as well as RAM. A generic KVM CPU may hide SSE4/POPCNT. Moving compilation to GitHub addresses the build-runner limitation; runtime embeddings need separate verification. The optional release `legacy_cpu` profile in DEPLOYMENT.md recompiles the pinned NumPy source and verifies build metadata and requires a target-host embedding preflight before API startup. If another native library fails, keep chat disabled and preserve data while investigating. Do not silently change embedding models or treat compilation as proof of runtime support.

Run `npm run doctor` from the repository root. Share the name of the failed check and a sanitized error category, not `.env`, tokens, customer messages or raw database exports.

| Symptom | Check and recovery |
| --- | --- |
| `npm`/Node missing or wrong version | Install Node 22.12–22.x, reopen the terminal, run `node --version` and `npm ci`. |
| Docker cannot connect | Start Docker Engine/Desktop; confirm `docker info` works. Check available memory/disk before building. |
| `initdb`/`pg_ctl` missing | Add PostgreSQL 16's `bin` directory to PATH as shown in INSTALLATION.md. |
| A port is occupied | Identify the existing owner. Do not kill an unrelated service. Configure a separate deployment or stop only your own earlier test stack. |
| Chat launcher exists but returns unavailable | Check `CHAT_ENABLED`, configured provider, successful indexing, published agent, server-only agent key and healthy Redis/worker. This fails closed deliberately. |
| Provider gives HTTP 200 with an upgrade/error message | Treat content as failure. Inspect the authorized provider's configuration; do not enable chat or silently choose another model. |
| Retrieval hangs | The worker consumes the embeddings and ingest queues; it is required. Check worker health and embedding model download/access. |
| Ingestion fails after `WorkerLostError` / `SIGKILL`, then reports a missing FAISS index | Check worker memory: the local embedding forward pass can exceed a 1 GiB container. Use `EMBEDDINGS_MODEL_BATCH_SIZE=1` (ONNX forwards), `EMBEDDINGS_BATCH_SIZE=4` (ingestion batches), and the default 2 GiB worker allowance, with enough host capacity. A killed task can leave a progress checkpoint without its unpublished FAISS index. Revoke that failed task through Celery and use the native source reingest action for a fresh task; do not delete database rows, indexes or volumes. An interrupted first upload without a saved source needs a fresh upload request key after its old task is stopped. |
| Worker runs tasks but its health check times out | Use the Compose control ping with `celery --broker` rather than `-A docsgpt.app.celery`; importing the full application for each health probe can exceed the deadline on constrained CPUs. |
| Ingestion fails | Inspect the protected source report, approved file/website boundaries and task status. Keep prior good content; do not delete an index to hide a transient fetch failure. |
| Existing secrets differ | Preserve them. Restore the prior encryption/signing settings or follow the pinned upstream rotation procedure. Never generate fresh keys just to make startup pass. |
| Setup refuses an existing source checkout | It has changes or a different revision. Preserve it and review the update deliberately. No reset/force checkout is performed. |
| Browser error or missing widget | Build the widget from the pinned fork, check its asset URL and browser console without customer data. English must remain LTR; Persian must remain scoped RTL. |

Useful Docker commands are `ps` and bounded `logs --tail=50`; review logs locally and redact them before sharing. Resetting a database, removing a volume, upgrading unrelated services or rewriting history is not a routine recovery step.
