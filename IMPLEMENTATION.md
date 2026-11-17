# Starter implementation checklist

- [x] Reuse the public pinned DocsGPT fork and its existing chat/search widgets.
- [x] Keep direction dynamic: Persian RTL, English LTR, widget roots scoped to their host.
- [x] Isolate private organization overlays and production exports from shareable code and build contexts.
- [x] Use TypeScript for starter setup, secrets, bootstrap, synchronization, diagnostics and privacy scanning.
- [x] Provide neutral settings and fictional knowledge without private service dependencies.
- [x] Provide native and Docker configurations with PostgreSQL, Redis, API, worker/beat, persistent state and migrations.
- [x] Exercise native setup, isolated services, indexing, retrieval and widget streaming with mocked generation.
- [x] Exercise Redis-backed gateway ownership and limits across two processes.
- [x] Verify clean-checkout dependency installation/checks and the Docker full-stack build, indexing and mocked widget streaming.
- [ ] Complete live model quality, retention, backup/restore and production release gates for each real deployment.

See `docs/VERIFICATION.md` for observed results and limitations. Do not infer deployment or readiness from this checklist alone.
