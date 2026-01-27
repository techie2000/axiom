FROM golang:1.21-alpine AS builder

WORKDIR /build

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates git

# Copy countries module first (to parent dir as per go.mod replace directive)
COPY modules/reference/countries /modules/reference/countries

# Copy canonicalizer module files
COPY canonicalizer/go.mod canonicalizer/go.sum* ./

# Bypass Go module proxy for corporate environments with TLS-inspecting proxies
# GOPROXY=direct fetches modules directly from source repositories
# GOINSECURE=* skips HTTPS verification for all domains (dev only!)
# For production, add your corporate CA certificate to the image instead
ENV GOPROXY=direct
ENV GOSUMDB=off
ENV GOINSECURE="*"
RUN git config --global http.sslVerify false
# Download dependencies
RUN go mod download
RUN go mod tidy

# Copy canonicalizer source
COPY canonicalizer/ .

# Build binary (keep env vars for any missing modules)
RUN CGO_ENABLED=0 GOOS=linux go build -mod=mod -o canonicalizer .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/canonicalizer .

CMD ["/app/canonicalizer"]
