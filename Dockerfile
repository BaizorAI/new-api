FROM ccr.ccs.tencentyun.com/lucky/oven-bun:1 AS builder

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
COPY web/default/package.json ./default/package.json
RUN bun install --frozen-lockfile \
    || bun install --frozen-lockfile \
    || bun install --frozen-lockfile
COPY ./web/default ./default
COPY ./VERSION /build/VERSION
RUN cd default && rm -rf dist && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat /build/VERSION) bun run build

FROM ccr.ccs.tencentyun.com/lucky/golang:1.26.1-alpine AS builder2
ENV GO111MODULE=on CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=builder /build/web/default/dist ./web/default/dist
RUN go build -ldflags "-s -w -X 'github.com/BaizorAI/new-api/common.Version=$(cat VERSION)'" -o new-api

FROM  ccr.ccs.tencentyun.com/lucky/debian:bookworm-slim

# Use a local mirror when the default Debian repo is unreachable from the
# build environment. Aliyun mirror is used over plain HTTP so that the build
# can bootstrap before ca-certificates is installed.
RUN set -eu; \
    sources=/etc/apt/sources.list.d/debian.sources; \
    if [ -f "$sources" ]; then \
        sed -i 's|https://deb.debian.org|http://mirrors.aliyun.com|g; \
                  s|https://security.debian.org|http://mirrors.aliyun.com|g; \
                  s|http://deb.debian.org|http://mirrors.aliyun.com|g; \
                  s|http://security.debian.org|http://mirrors.aliyun.com|g' "$sources"; \
    fi; \
    apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=builder2 /build/new-api /
COPY --from=builder2 /build/web/default/dist /web/default/dist
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md /licenses/
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/new-api"]
