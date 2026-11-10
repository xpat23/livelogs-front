FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.25 AS server
WORKDIR /src
COPY cmd/web/main.go ./main.go
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -o /out/web ./main.go

FROM scratch
COPY --from=server /out/web /web-server
COPY --from=build /src/dist /web
USER 65532:65532
ENV API_URL=http://127.0.0.1:8068
ENV AUTH_URL=https://auth.finlogs.org
EXPOSE 4000
ENTRYPOINT ["/web-server"]
