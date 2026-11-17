# Updating the starter and upstream fork

Record the current source SHA, image digest, configuration, data backups and tested rollback plan. Keep signing/encryption keys stable. Preserve uncommitted work; never reset or force-push to make an update convenient.

The source lock points to a public fork commit containing Persian/RTL support. The upstream pull request is linked in `source.lock.json`; a submitted PR is not evidence that it merged. Before moving to another revision, confirm the Persian catalogs, locale registries, direction switching and widget changes are present. Do not replace the fork with an unchanged public npm package.

Review upstream contribution/deployment instructions at the candidate revision. Compare database/worker/embedding requirements and supported API/schema changes. Update the full immutable revision deliberately. Setup refuses to overwrite an existing modified or different checkout; preserve it for rollback and prepare a new clean checkout rather than bypassing the guard.

Run `npm ci`, `npm run check`, both complete installation paths, fictional indexing, retrieval, gateway isolation, widget connectivity and Persian/English browser tests. Re-embed only when the embedding configuration changes, not merely when changing the chat model. Validate migrations and restore compatibility before production deployment. Report untested platforms and failures honestly.

After upstream merges localization, switch only to a verified commit containing that merge and rerun regression checks. Publishing images or release archives, changing visibility or rewriting shared history requires explicit authorization.
