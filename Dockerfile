FROM golang:1.19-alpine AS builder
ENV CGO_ENABLED=0
WORKDIR /backend

COPY vm/go.* .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY vm/. .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o bin/service

ENV VERSION="v1.13.1"
ENV BASE_URL="https://github.com/sigstore/cosign/releases/download/"

RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache curl bash

RUN bash -c "mkdir -p /data/bin/{darwin,linux,windows}" && \
    curl -sLJ -o /data/bin/darwin/cosign ${BASE_URL}/${VERSION}/cosign-darwin-arm64 && \
    curl -sLJ -o /data/bin/linux/cosign ${BASE_URL}/${VERSION}/cosign-linux-amd64 && \
    curl -sLJ -o /data/bin/windows/cosign.exe ${BASE_URL}/${VERSION}/cosign-windows-amd64.exe && \
    bash -c "chmod +x /data/bin/{darwin,linux}/cosign"


FROM --platform=$BUILDPLATFORM node:18.9-alpine3.15 AS client-builder
WORKDIR /ui
# cache packages in layer
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci
# install
COPY ui /ui
RUN npm run build

FROM alpine
LABEL org.opencontainers.image.title="Cosign Extension" \
    org.opencontainers.image.description="A simple extension to sign and verify your Docker images" \
    org.opencontainers.image.vendor="Ivan" \
    com.docker.desktop.extension.api.version="0.3.0" \
    com.docker.extension.screenshots="" \
    com.docker.extension.detailed-description="" \
    com.docker.extension.publisher-url="" \
    com.docker.extension.additional-urls="" \
    com.docker.extension.changelog=""

COPY --from=builder /backend/bin/service /
COPY --from=builder /data/bin /data/bin
COPY docker-compose.yaml .
COPY metadata.json .
COPY docker.svg .
COPY --from=client-builder /ui/build ui
COPY /data/cosign.pub /data/cosign.pub
CMD /service -socket /run/guest-services/extension-cosign.sock
