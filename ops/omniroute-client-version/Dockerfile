ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER root
ARG IDE_VERSION
ARG CLI_VERSION
COPY patch.ts /opt/client-version-patch.ts
RUN node --experimental-strip-types /opt/client-version-patch.ts /app "$IDE_VERSION" "$CLI_VERSION" \
 && node --check /app/.build/next/server/chunks/73873.js \
 && node --check /app/.build/next/server/chunks/73716.js \
 && node --check /app/.build/next/server/middleware.js
USER node
