FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS widget
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
ARG DOCSGPT_REPOSITORY=https://github.com/amirho1/DocsGPT.git
ARG DOCSGPT_REVISION=20173203af16892ee02ad347d2d6e6a1d8f3d371
WORKDIR /source
RUN git init && git remote add origin "$DOCSGPT_REPOSITORY" && git fetch --depth 1 origin "$DOCSGPT_REVISION" && git checkout --detach FETCH_HEAD
WORKDIR /source/extensions/react-widget
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund && npm run build

FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
WORKDIR /starter
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node config ./config
COPY --chown=node:node demo ./demo
COPY --chown=node:node source.lock.json ./
COPY --from=widget --chown=node:node /source/extensions/react-widget/dist/modern/browser.js .runtime/docsgpt/extensions/react-widget/dist/modern/browser.js
RUN mkdir -p /starter/.runtime/state && chown -R node:node /starter/.runtime
USER node
ENV BIND_HOST=0.0.0.0
EXPOSE 3080
CMD ["npm", "start"]
