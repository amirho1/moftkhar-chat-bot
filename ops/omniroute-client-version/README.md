# Optional existing-router compatibility image

This operation is independent of the starter. Installation does not require OmniRoute.
Use it only for the reviewed OmniRoute 3.8.51 image whose three compiled version
resolver bundles match `patch.ts`. Unexpected or already patched bundles fail closed.

Upstream [issue 19619](https://github.com/cheaper-inference/OmniRoute/issues/19619)
reports Antigravity client obsolescence returned as HTTP 200 assistant text.
[PR 19602](https://github.com/cheaper-inference/OmniRoute/pull/19602) updates the
CLI fallback; [PR 20306](https://github.com/cheaper-inference/OmniRoute/pull/20306)
addresses current version discovery. These proposals were unmerged when reviewed.
This narrow compatibility layer changes only the existing IDE/CLI version floors,
using explicitly verified official versions. It does not import a whole unmerged PR,
change provider credentials, grant model access or guarantee upstream availability.

1. Record the current router image digest and private Compose configuration. Preserve
   a consistent, private backup of its data volume and verify the rollback image exists.
2. Verify the **standalone IDE** version on Google's download page and the CLI release
   on `google-antigravity/antigravity-cli`. App/extension/SDK versions are separate.
3. Run **Build optional router compatibility image** on GitHub with the immutable
   existing base digest and numeric IDE/CLI versions. Checks and syntax validation must
   pass before the image is published. This workflow does not automatically deploy.
4. Use the resulting immutable image digest in the existing deployment through your
   deployment manager. Preserve environment secrets, networks, volumes and routing.
5. Check container health and authenticated model generation, streaming and non-streaming,
   with a unique Persian question and cache bypass. A 200 or green model test is insufficient:
   assert meaningful Persian content and absence of the upgrade notice.
6. After correcting generation, clear semantic cache through the authenticated dashboard
   to remove previously cached refusals. The cache fix alone cannot repair a stale client.
7. If checks fail, restore the previous image digest through the deployment manager.
   Do not delete volumes or downgrade a migrated database blindly. This layer keeps the
   same router version and does not introduce migrations.

No production credentials or data belong in this directory or its build context.
Retire this layer once a released upstream version is verified to solve the problem.
