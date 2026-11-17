# Verification record

Status: reusable starter under verification; live production answer quality is not certified.

Verified locally on macOS ARM64 with Node 22 and Docker Desktop Linux ARM64:

- Native setup from a fresh pinned public DocsGPT source checkout: Python/uv dependencies, frontend/widget production builds, dedicated PostgreSQL 16 and Redis, migrations, API, Celery worker/beat, and gateway.
- Docker build and startup of API/UI, worker/beat, PostgreSQL, Redis, gateway and explicitly selected fictional mock-model profile. Health checks passed. A first build with only 2 GiB Docker RAM failed; setup now checks for at least 4 GiB.
- Both modes ingested `demo/knowledge.md` using the actual multilingual Granite embedding worker and FAISS, then created a native draft agent. A temporary local publication streamed an answer with retrieved source events; the agent was restored to draft.
- Actual browser widget at 390px: Persian language/RTL, no generation on visit, one explicit request, source heading visible. Model was explicitly mocked: these checks prove protocol/retrieval wiring, not AI answer quality.
- TypeScript type checking and seven tests passed, including two gateway processes sharing Redis limits and conversation ownership, bounded input, override refusal, SSE projection and redacted scanning.
- Upstream fork verification: frontend 5,945 tests, widget four locale tests, five Playwright RTL/LTR/IME cases, and production builds. Existing lint warnings remain in upstream.
- Shareable working-tree snapshot: internal scanner and Gitleaks found no matching secrets. Private overlays, environment files, logs and knowledge indexes are excluded. Deletion from a tree does not remove history; scan reachable history again after commits.

Not yet verified: native Linux, Windows/WSL2, Linux AMD64 production builds, a fresh starter Git clone workflow, backup restoration, automated conversation-retention cleanup, production ingress, paid-provider generation, provider-specific reasoning behavior, and live production customer-support evaluation. Mock tests cannot clear these gates. Test data is fictional and separate from production volumes.

Privacy limitations: pattern scans may miss unknown formats, binary data, unreachable Git objects, remote mirrors, caches and externally published artifacts. Review tracked files, history and artifacts before public release. Rotate any exposed credentials through the provider. No shared history was rewritten and no repository visibility was changed.
