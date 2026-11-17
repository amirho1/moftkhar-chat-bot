# Verification record

Status: reusable starter under verification; live production answer quality is not certified.

Verified locally on macOS ARM64 with Node 22 and Docker Desktop Linux ARM64:

- Native setup from a fresh pinned public DocsGPT source checkout: Python/uv dependencies, frontend/widget production builds, dedicated PostgreSQL 16 and Redis, migrations, API, Celery worker/beat, and gateway.
- Docker build and startup of API/UI, worker/beat, PostgreSQL, Redis, gateway and explicitly selected fictional mock-model profile. Health checks passed. A first build with only 2 GiB Docker RAM failed; setup now checks for at least 4 GiB.
- Both modes ingested `demo/knowledge.md` using the actual multilingual Granite embedding worker and FAISS, then created a native draft agent. A temporary local publication streamed an answer with retrieved source events; the agent was restored to draft.
- Actual browser widget at 390px: Persian language/RTL, no generation on visit, one explicit request, source heading visible. Model was explicitly mocked: these checks prove protocol/retrieval wiring, not AI answer quality.
- TypeScript type checking and seven tests passed, including two gateway processes sharing Redis limits and conversation ownership, bounded input, override refusal, SSE projection and redacted scanning.
- Upstream fork verification: frontend 5,945 tests, widget four locale tests, five Playwright RTL/LTR/IME cases, and production builds. Existing lint warnings remain in upstream.
- GitHub Linux AMD64 builds: the pinned backend and gateway built successfully; actual offline Granite tokenization/embedding passed on the modern runner. Production on an old generic KVM CPU rejected the standard NumPy wheel (`X86_V2`). The same-version NumPy source compatibility layer built and passed modern-runner inference. A QEMU test stalled and was cancelled; it is not a compatibility pass. The release now requires a target-native preflight before API startup for legacy CPU deployments.
- Release validation now includes ten local tests with the explicitly configured Redis integration, including immutable image validation and enforcement of the target-host CPU preflight. CI without Redis skips that one integration test.
- Clean starter Git clone: `npm ci --ignore-scripts` and `npm run check` passed (six tests passed, Redis integration skipped without its explicit URL). The Redis integration passed separately on the operator's dedicated local Redis.
- Shareable working-tree snapshot and initial reachable Git history: internal scanner and Gitleaks found no matching secrets. Private overlays, environment files, logs and knowledge indexes are excluded. Deletion from a tree does not remove history; repeat scans after changes.

Not yet verified: native Linux, Windows/WSL2, every target CPU profile, clean-checkout full native/Docker setup, backup restoration, automated conversation-retention cleanup, production management ingress, paid-provider answer quality, provider-specific reasoning behavior, and live production customer-support evaluation. Mock tests cannot clear these gates. Test data is fictional and separate from production volumes.

Privacy limitations: pattern scans may miss unknown formats, binary data, unreachable Git objects, remote mirrors, caches and externally published artifacts. Review tracked files, history and artifacts before public release. Rotate any exposed credentials through the provider. No shared history was rewritten and no repository visibility was changed.
